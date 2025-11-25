// 初始化地圖（預設台北市中心）
const map = L.map('map').setView([25.0330, 121.5654], 13);

// 添加地圖圖層
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors',
    maxZoom: 19
}).addTo(map);

// 儲存路線點和折線
let routePoints = [];
let polyline = null;
let markers = [];
let currentLocationMarker = null;

// 更新距離顯示
function updateDistance() {
    if (routePoints.length < 2) {
        document.getElementById('distance').textContent = '0 公尺';
        return;
    }

    let totalDistance = 0;
    for (let i = 0; i < routePoints.length - 1; i++) {
        const point1 = routePoints[i];
        const point2 = routePoints[i + 1];
        totalDistance += calculateDistance(point1, point2);
    }

    // 格式化距離顯示
    if (totalDistance >= 1000) {
        document.getElementById('distance').textContent = 
            (totalDistance / 1000).toFixed(2) + ' 公里';
    } else {
        document.getElementById('distance').textContent = 
            totalDistance.toFixed(2) + ' 公尺';
    }
}

// 使用 Haversine 公式計算兩點間距離（單位：公尺）
function calculateDistance(point1, point2) {
    const R = 6371e3; // 地球半徑（公尺）
    const φ1 = point1.lat * Math.PI / 180;
    const φ2 = point2.lat * Math.PI / 180;
    const Δφ = (point2.lat - point1.lat) * Math.PI / 180;
    const Δλ = (point2.lng - point1.lng) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
}

// 更新點數顯示
function updatePointCount() {
    document.getElementById('pointCount').textContent = routePoints.length;
}

// 使用 OSRM 路徑規劃 API 繪製沿著道路的路線
async function drawRoute() {
    // 移除舊的折線
    if (polyline) {
        map.removeLayer(polyline);
    }

    // 如果只有一個點，不繪製路線
    if (routePoints.length < 2) {
        return;
    }

    try {
        // 構建 OSRM API 請求
        const coordinates = routePoints.map(p => `${p.lng},${p.lat}`).join(';');
        const url = `https://router.project-osrm.org/route/v1/driving/${coordinates}?overview=full&geometries=geojson`;
        
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
            const route = data.routes[0];
            const coordinates = route.geometry.coordinates.map(coord => [coord[1], coord[0]]);
            
            // 繪製沿著道路的路線
            polyline = L.polyline(coordinates, {
                color: '#667eea',
                weight: 4,
                opacity: 0.8,
                smoothFactor: 1
            }).addTo(map);
            
            // 更新距離（使用 OSRM 計算的實際道路距離）
            const distance = route.distance; // 單位：公尺
            if (distance >= 1000) {
                document.getElementById('distance').textContent = 
                    (distance / 1000).toFixed(2) + ' 公里';
            } else {
                document.getElementById('distance').textContent = 
                    distance.toFixed(2) + ' 公尺';
            }
        } else {
            // 如果 OSRM 失敗，使用直線連接
            polyline = L.polyline(routePoints, {
                color: '#667eea',
                weight: 4,
                opacity: 0.8,
                smoothFactor: 1,
                dashArray: '10, 10' // 虛線表示非道路路線
            }).addTo(map);
            updateDistance(); // 使用原本的距離計算
        }
    } catch (error) {
        console.error('路徑規劃失敗:', error);
        // 發生錯誤時使用直線連接
        polyline = L.polyline(routePoints, {
            color: '#667eea',
            weight: 4,
            opacity: 0.8,
            smoothFactor: 1
        }).addTo(map);
        updateDistance();
    }
}

// 地圖點擊事件
map.on('click', async function(e) {
    const latlng = e.latlng;
    
    // 添加點到路線
    routePoints.push(latlng);
    
    // 創建標記
    const markerNumber = routePoints.length;
    const marker = L.marker(latlng, {
        icon: L.divIcon({
            className: 'custom-marker',
            html: `<div style="
                background: #667eea;
                color: white;
                width: 30px;
                height: 30px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                font-weight: bold;
                border: 3px solid white;
                box-shadow: 0 2px 5px rgba(0,0,0,0.3);
            ">${markerNumber}</div>`,
            iconSize: [30, 30],
            iconAnchor: [15, 15]
        })
    }).addTo(map);
    
    markers.push(marker);
    
    // 更新路線和資訊
    await drawRoute();
    updatePointCount();
});

// 清除路線
document.getElementById('clearBtn').addEventListener('click', function() {
    // 移除所有標記
    markers.forEach(marker => map.removeLayer(marker));
    markers = [];
    
    // 移除折線
    if (polyline) {
        map.removeLayer(polyline);
        polyline = null;
    }
    
    // 清空路線點
    routePoints = [];
    
    // 更新顯示
    updateDistance();
    updatePointCount();
});

// 復原上一點
document.getElementById('undoBtn').addEventListener('click', async function() {
    if (routePoints.length === 0) return;
    
    // 移除最後一個點
    routePoints.pop();
    
    // 移除最後一個標記
    const lastMarker = markers.pop();
    if (lastMarker) {
        map.removeLayer(lastMarker);
    }
    
    // 重新繪製路線
    await drawRoute();
    updatePointCount();
});

// 搜尋地址功能
document.getElementById('searchBtn').addEventListener('click', searchLocation);
document.getElementById('searchInput').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        searchLocation();
    }
});

async function searchLocation() {
    const query = document.getElementById('searchInput').value.trim();
    if (!query) return;
    
    try {
        // 使用 Nominatim API 搜尋地址
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5`;
        const response = await fetch(url);
        const results = await response.json();
        
        displaySearchResults(results);
    } catch (error) {
        console.error('搜尋失敗:', error);
        alert('搜尋失敗，請稍後再試');
    }
}

function displaySearchResults(results) {
    const resultsDiv = document.getElementById('searchResults');
    resultsDiv.innerHTML = '';
    
    if (results.length === 0) {
        resultsDiv.innerHTML = '<div style="padding: 10px; color: #6c757d;">找不到相關地點</div>';
        return;
    }
    
    results.forEach(result => {
        const item = document.createElement('div');
        item.className = 'search-result-item';
        item.innerHTML = `
            <strong>${result.display_name}</strong>
            <small style="color: #6c757d;">類型: ${result.type || '未知'}</small>
        `;
        item.addEventListener('click', () => {
            const lat = parseFloat(result.lat);
            const lon = parseFloat(result.lon);
            map.setView([lat, lon], 15);
            
            // 添加臨時標記顯示搜尋結果
            if (currentLocationMarker) {
                map.removeLayer(currentLocationMarker);
            }
            currentLocationMarker = L.marker([lat, lon], {
                icon: L.icon({
                    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
                    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
                    iconSize: [25, 41],
                    iconAnchor: [12, 41],
                    popupAnchor: [1, -34],
                    shadowSize: [41, 41]
                })
            }).addTo(map).bindPopup(result.display_name).openPopup();
            
            resultsDiv.innerHTML = '';
        });
        resultsDiv.appendChild(item);
    });
}

// 取得使用者當前位置
document.getElementById('locationBtn').addEventListener('click', function() {
    if (!navigator.geolocation) {
        alert('您的瀏覽器不支援定位功能');
        return;
    }
    
    navigator.geolocation.getCurrentPosition(
        function(position) {
            const lat = position.coords.latitude;
            const lon = position.coords.longitude;
            
            map.setView([lat, lon], 15);
            
            // 添加當前位置標記
            if (currentLocationMarker) {
                map.removeLayer(currentLocationMarker);
            }
            currentLocationMarker = L.marker([lat, lon], {
                icon: L.icon({
                    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
                    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
                    iconSize: [25, 41],
                    iconAnchor: [12, 41],
                    popupAnchor: [1, -34],
                    shadowSize: [41, 41]
                })
            }).addTo(map).bindPopup('📍 您的位置').openPopup();
        },
        function(error) {
            let message = '無法取得您的位置';
            switch(error.code) {
                case error.PERMISSION_DENIED:
                    message = '您拒絕了定位請求';
                    break;
                case error.POSITION_UNAVAILABLE:
                    message = '位置資訊無法取得';
                    break;
                case error.TIMEOUT:
                    message = '定位請求逾時';
                    break;
            }
            alert(message);
        }
    );
});
