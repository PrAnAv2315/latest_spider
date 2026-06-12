import csv
import json
import math
import random
import socket
import time
from io import StringIO
from datetime import datetime, timezone

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List

from geopy.distance import geodesic
from shapely.geometry import Polygon, Point

app = FastAPI(title="SIMCORE v2.5 Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==========================================================
# PYDANTIC MODELS (React -> Python Data Structures)
# ==========================================================
class DeviceModel(BaseModel):
    id: str
    type: str
    lat: float
    lng: float
    innerRange: float
    outerRange: float
    azimuth: float
    fov: float

class TransmitRequest(BaseModel):
    targetIp: str
    targetPort: int
    trackId: int
    device: DeviceModel

class ExportRequest(BaseModel):
    scenarioName: str
    devices: List[DeviceModel]
    alerts: List[dict]

# ==========================================================
# PHYSICS & MATH (From radar_simulator_v2.5.py)
# ==========================================================
def generate_uniform_distance(min_range, max_range):
    return math.sqrt(random.uniform(min_range ** 2, max_range ** 2))

def determine_priority(distance):
    if distance <= 1500: return "HIGH"
    if distance <= 3500: return "MEDIUM"
    return "LOW"

# ==========================================================
# PACKET BUILDERS (From radar_simulator_v2.5.py)
# ==========================================================
def build_spider_packet(alert, device, track_id):
    """Exact 21-Index SPIDER format as requested in Docs"""
    dev_type_int = 9 if device.type.lower() == "radar" else 10 if device.type.lower() == "camera" else 11
    fov_start = (device.azimuth - (device.fov / 2)) % 360
    fov_end = (device.azimuth + (device.fov / 2)) % 360
    
    clean_id = device.id.replace("RADAR_", "").replace("CAM_", "").replace("PIDS_", "")
    
    packet = [
        clean_id, dev_type_int, round(device.lat, 6), round(device.lng, 6), 0,
        round(device.azimuth, 2), round(fov_start, 2), round(fov_end, 2), track_id,
        round(alert["latitude"], 8), round(alert["longitude"], 8), round(alert["distance_m"], 2),
        round(alert["bearing"], 2), 0, 95, int(time.time()), 0, "", 0, 0, 0
    ]
    return ",".join(map(str, packet))

# ==========================================================
# ENDPOINT 1: CALCULATE & TRANSMIT
# ==========================================================
@app.post("/api/transmit")
async def calculate_and_transmit(payload: TransmitRequest):
    dev = payload.device
    
    # EXACT GEOPY MATH FROM YOUR SCRIPT
    distance = generate_uniform_distance(dev.innerRange, dev.outerRange)
    
    if dev.type.lower() == "camera":
        half_fov = dev.fov / 2
        bearing = random.uniform(dev.azimuth - half_fov, dev.azimuth + half_fov) % 360
    else:
        bearing = random.uniform(0, 360)

    destination = geodesic(meters=distance).destination((dev.lat, dev.lng), bearing)
    priority = determine_priority(distance)

    alert_data = {
        "sensor_type": dev.type.upper(),
        "sensor_name": dev.id,
        "alert_id": payload.trackId,
        "priority": priority,
        "latitude": round(destination.latitude, 8),
        "longitude": round(destination.longitude, 8),
        "distance_m": round(distance, 2),
        "bearing": round(bearing, 2),
        "timestamp": datetime.now(timezone.utc).isoformat()
    }

    # FIRE UDP PACKET (THIS ACTUALLY SENDS THE DATA)
    packet_string = build_spider_packet(alert_data, dev, payload.trackId)
    udp_socket = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        udp_socket.sendto(packet_string.encode('utf-8'), (payload.targetIp, payload.targetPort))
    finally:
        udp_socket.close()

    return {"status": "success", "packet": packet_string, "alert_data": alert_data}

# ==========================================================
# ENDPOINT 2: GENERATE FILES (KML + CSV)
# ==========================================================
@app.post("/api/export")
async def generate_exports(payload: ExportRequest):
    
    # 1. GENERATE CSV EXACTLY LIKE SCRIPT
    csv_io = StringIO()
    writer = csv.writer(csv_io)
    writer.writerow(["sensor_type", "sensor_name", "alert_id", "priority", "latitude", "longitude", "distance_m", "bearing", "timestamp"])
    for alert in payload.alerts:
        writer.writerow([alert["sensor_type"], alert["sensor_name"], alert["alert_id"], alert["priority"], alert["latitude"], alert["longitude"], alert["distance_m"], alert["bearing"], alert["timestamp"]])
    
    # 2. GENERATE KML EXACTLY LIKE SCRIPT
    kml = f'''<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
<Document>
    <name>{payload.scenarioName} Report</name>
    <Style id="radarStyle"><IconStyle><color>ff0000ff</color><scale>1.4</scale></IconStyle></Style>
    <Style id="cameraStyle"><IconStyle><color>ffff0000</color><scale>1.4</scale></IconStyle></Style>
    <Style id="radarHighStyle"><IconStyle><color>ff0000ff</color><scale>1.2</scale></IconStyle></Style>
    <Style id="radarMediumStyle"><IconStyle><color>ff00ffff</color><scale>1.2</scale></IconStyle></Style>
    <Style id="radarLowStyle"><IconStyle><color>ff00ff00</color><scale>1.2</scale></IconStyle></Style>
    <Style id="cameraHighStyle"><IconStyle><color>ffffffff</color><scale>1.2</scale></IconStyle></Style>
    <Style id="cameraMediumStyle"><IconStyle><color>ffffffff</color><scale>1.2</scale></IconStyle></Style>
    <Style id="cameraLowStyle"><IconStyle><color>ffffffff</color><scale>1.2</scale></IconStyle></Style>
    <Style id="pidsAlertStyle"><IconStyle><color>ffffff00</color><scale>1.3</scale></IconStyle></Style>
'''

    # Draw Physical Sensors & Geometries (Circles/Arcs)
    for dev in payload.devices:
        style = "#radarStyle" if dev.type.lower() == "radar" else "#cameraStyle"
        kml += f'<Placemark><name>{dev.id}</name><styleUrl>{style}</styleUrl><Point><coordinates>{dev.lng},{dev.lat},0</coordinates></Point></Placemark>'
        
        if dev.type.lower() == "camera":
            # Draw EXACT Camera Arc
            start_bearing = (dev.azimuth - (dev.fov / 2)) % 360
            end_bearing = (dev.azimuth + (dev.fov / 2)) % 360
            arc_points = []
            angle = start_bearing
            while True:
                pt = geodesic(meters=dev.outerRange).destination((dev.lat, dev.lng), angle)
                arc_points.append(f"{pt.longitude},{pt.latitude},0")
                angle = (angle + 2) % 360
                if abs((angle - end_bearing + 360) % 360) < 2: break
            
            kml += f'''
            <Placemark><name>{dev.id} FOV</name>
                <Style><LineStyle><color>66ff0000</color><width>1</width></LineStyle><PolyStyle><color>2200ff00</color></PolyStyle></Style>
                <Polygon><outerBoundaryIs><LinearRing><coordinates>{dev.lng},{dev.lat},0 {" ".join(arc_points)} {dev.lng},{dev.lat},0</coordinates></LinearRing></outerBoundaryIs></Polygon>
            </Placemark>'''
            
        elif dev.type.lower() == "radar":
            # Draw EXACT Radar Circles
            outer_pts = []
            inner_pts = []
            for angle in range(361):
                opt = geodesic(meters=dev.outerRange).destination((dev.lat, dev.lng), angle)
                ipt = geodesic(meters=dev.innerRange).destination((dev.lat, dev.lng), angle)
                outer_pts.append(f"{opt.longitude},{opt.latitude},0")
                inner_pts.append(f"{ipt.longitude},{ipt.latitude},0")
            
            kml += f'<Placemark><name>{dev.id} Boundary</name><LineString><coordinates>{" ".join(outer_pts)}</coordinates></LineString></Placemark>'
            kml += f'<Placemark><name>{dev.id} Exclusion</name><LineString><coordinates>{" ".join(inner_pts)}</coordinates></LineString></Placemark>'

    # Draw Generated Alerts
    for alert in payload.alerts:
        if alert["sensor_type"] == "RADAR":
            style = "#radarHighStyle" if alert["priority"] == "HIGH" else "#radarMediumStyle" if alert["priority"] == "MEDIUM" else "#radarLowStyle"
        elif alert["sensor_type"] == "PIDS":
            style = "#pidsAlertStyle"
        else:
            style = "#cameraHighStyle" if alert["priority"] == "HIGH" else "#cameraMediumStyle" if alert["priority"] == "MEDIUM" else "#cameraLowStyle"

        kml += f'''
        <Placemark>
            <name>{alert["sensor_name"]}_{alert["alert_id"]}</name>
            <description>Priority: {alert["priority"]}\nDistance: {alert["distance_m"]}m\nTimestamp: {alert["timestamp"]}</description>
            <styleUrl>{style}</styleUrl>
            <Point><coordinates>{alert["longitude"]},{alert["latitude"]},0</coordinates></Point>
        </Placemark>'''

    kml += "\n</Document>\n</kml>"

    return {"csv_content": csv_io.getvalue(), "kml_content": kml}