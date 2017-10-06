var map = L.map('map');

L.tileLayer('http://{s}.tile.osm.org/{z}/{x}/{y}.png', {
	attribution: 'Powered by <a href="https://www.esri.com">Esri</a> | &copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
}).addTo(map);

var control = L.Routing.control({
	waypoints: [
		L.latLng(49.231230, -122.592263),
		L.latLng(49.459070, -123.235190)
	],
	router: L.Routing.esri({
    liveTraffic: false,
		profile: 'Trucking',
    serviceUrl: 'https://utility.arcgis.com/usrsvcs/appservices/rdcfU1A3eVNshs0d/rest/services/World/Route/NAServer/Route_World'
  }),
	geocoder: L.Control.Geocoder.nominatim(),
	routeWhileDragging: true,
	reverseWaypoints: true
}).addTo(map);

L.Routing.errorControl(control).addTo(map);
