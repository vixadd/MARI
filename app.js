/**
 ***************************** CNU Imprint *******************************
 *                                                                       *
 * Map that helps visualize obsticle location using Open Street Map as a *
 * dependency for the application. Obsticle updates, and creations are   *
 * specified in methods, and functions.                                  *
 *                                                                       *
 ***************************** CNU Imprint *******************************
 *
 *
 * @version 06/15/2016
 * @author  davidkroell
 * @see     ../views/index.html
 *
 */


var preflight = {
        "flight_boundaries": [{"longitude":38.1462694444, "latitude":-76.4281638889},
                              {"longitude":38.151625,     "latitude":-76.4286833333},
                              {"longitude":38.1518888889, "latitude":-76.4314666667},
                              {"longitude":38.1505944444, "latitude":-76.4353611111},
                              {"longitude":38.1475666667, "latitude":-76.4323416667},
                              {"longitude":38.1446666667, "latitude":-76.4329472222},
                              {"longitude":38.1432555556, "latitude":-76.4347666667},
                              {"longitude":38.1404638889, "latitude":-76.4326361111},
                              {"longitude":38.1407194444, "latitude":-76.4260138889},
                              {"longitude":38.1437611111, "latitude":-76.4212055556},
                              {"longitude":38.1473472222, "latitude":-76.4232111111},
                              {"longitude":38.1461305556, "latitude":-76.4266527778}],
        "SRIC_Position": {
                                "longitude":-76.4266013,
                                "latitude":38.1470837
                         }
}


//Create the Map from the Open Layers Dependency from OSM.
map = new OpenLayers.Map("mapdiv");

var map_layer = new OpenLayers.Layer.OSM("Local Tiles", "map_app/tiles/${z}/${x}/${y}.png");
map.addLayer(map_layer);

// Has the stationary obstacle array been called yet?
hasBeenCalled = false; 

//Count for redrawing the map to prevent tile rendering issues.
count = 0;

//Zoom into the map that we use for viewing.
var zoom = 17;

//Do we keep zoom constant throughout the flight?
// var zoomunlock = 18;
var zoomlocked = true;

//Create global vector layers for the obstacles and the plane.
var vectorLayer = new OpenLayers.Layer.Vector("Overlay", {
        isBaseLayer: true,
        renderers: ['SVG', 'Canvas', 'VML']
});

var Obst_Layer = new OpenLayers.Layer.Vector("Overlay_Obst", {
        renderers: ['SVG', 'Canvas', 'VML']
});
 
var planeLayer = new OpenLayers.Layer.Vector("Plane", {
        renderers: ['SVG', 'Canvas', 'VML']
});

var waypointLayer = new OpenLayers.Layer.Vector("Plane", {
    renderers: ['SVG', 'Canvas', 'VML']
});

//preflight Layer for SRIC and flight boundaries
var preflightLayer = new OpenLayers.Layer.Vector("SRIC/Boundaries", {
	renderers: ['SVG', 'Canvas', 'VML']
});

//Make the plane marker for the Open Layers Marker layer.
var feature = new OpenLayers.Feature.Vector(
	      new OpenLayers.Geometry.Point(-76.427991, 38.144616).transform(new OpenLayers.Projection("EPSG:4326"),
       	      map.getProjectionObject()),
		  {description:'X-8 Plane for AUVSI SUAS Competition'} ,
		  { externalGraphic: 'map_app/img/star_plane.png', 
		  graphicHeight: 30, graphicWidth: 30, graphicXOffset:-12, graphicYOffset:-25, graphicZIndex:12 });

//Add the Plane's Icon automatically to the center of the runway.
// vectorLayer.addFeatures(feature);
map.addLayer(vectorLayer);
map.addLayer(Obst_Layer);
map.addLayer(planeLayer); 
map.addLayer(waypointLayer);
map.addLayer(preflightLayer);

// Where to position the map (Initially)
var lonLat = new OpenLayers.LonLat( -76.427991,38.144616 )                     
    .transform(                                                             
	       new OpenLayers.Projection("EPSG:4326"), // transform from WGS 1984  
	       map.getProjectionObject() // to Spherical Mercator Projection       
									    );
map.setCenter (lonLat, zoom);

//queue implementation for tracer display. To avoid overload.
var queue_plane = [];

//Have the stationary obsticles been called?
var StationaryObstBeenCalled = false;
    
//Holds moving obstacles in array in JSON format.
var movingObstacles = [];

//Has the plane obsticle moved?
var hasMoved = false;

//hold current waypoint set
var currentWaypointSet = {};

/**
 * Create SRIC and position boundary locations
 */
function initKeyLocations() {
    sric_lon = preflight.SRIC_Position.longitude;
    sric_lat = preflight.SRIC_Position.latitude;
    
    var sric = new OpenLayers.Feature.Vector(
			 new OpenLayers.Geometry.Point(sric_lon, sric_lat).transform(
			     new OpenLayers.Projection("EPSG:4326"),
			     map.getProjectionObject()),
			     {description:'SRIC Position on Field'} ,
			     {externalGraphic: 'map_app/img/star_plane.png',
			     graphicHeight: 30, graphicWidth: 30, graphicXOffset:-12, graphicYOffset:-25, graphicZIndex:12 });

    preflightLayer.addFeatures(sric);
    //UpdateLayer(null, preflightLayer, [sric]);    

    var boundary_array = preflight.flight_boundaries;

    var points = [];
    
    var vectLayer = new OpenLayers.Layer.Vector("Overlay");

    epsg4326 =  new OpenLayers.Projection("EPSG:4326"); //WGS 1984 projection
    projectTo = map.getProjectionObject(); //The map projection (Spherical Mercator)

    for(var i = 0; i < boundary_array.length; i++) {
	point = new OpenLayers.Geometry.Point( boundary_array[i].latitude, boundary_array[i].longitude).transform(epsg4326, projectTo);
	points.push(point);
	//console.log(point);
    }

    points.push(new OpenLayers.Geometry.Point( boundary_array[0].latitude, boundary_array[0].longitude).transform(epsg4326, projectTo));
    var feature = new OpenLayers.Feature.Vector(
			new OpenLayers.Geometry.LineString(points)
		     );

    vectLayer.addFeatures(feature);
    map.addLayer(vectLayer);
    
}

initKeyLocations();

/**
 * Change the location of the plane marker leaving tracer.
 * Is called from interoperability.
 * 
 * @see _JAM/views/index.html
 * @param lon - Longitude of new waypoint
 * @param lat - Latitude of the new waypoint.
 * @return - updated plane marker.
 */
function changePlaneLoc(lon, lat, hdg) {

    if (queue_plane.length >= 18) {
        planeLayer.removeFeatures(queue_plane[0]);
        queue_plane.shift();
    }

    feature.style.externalGraphic = 'map_app/img/track_pixel.png';
    feature.style.graphicHeight = 7;
    feature.style.graphicWidth = 7;
    feature.style.graphicXOffset = 0;
    feature.style.graphicYOffset = 0;

    queue_plane.push(feature);

    var trackFeature = feature;

    feature = new OpenLayers.Feature.Vector(
	      new OpenLayers.Geometry.Point(lon, lat).transform(new OpenLayers.Projection("EPSG:4326"),
              map.getProjectionObject()),
	{description:'X-8 Plane for AUVSI Competition'},
	            {externalGraphic:'map_app/img/airplane.png',
                    graphicHeight: 35, graphicWidth: 35, graphicXOffset:-14.5, graphicYOffset:-25, rotation: hdg });
    
    UpdateLayer(null, planeLayer, [feature, trackFeature]);

    var lonLat = new OpenLayers.LonLat( lon, lat )                     
        .transform(                                                             
		   new OpenLayers.Projection("EPSG:4326"), // transform from WGS 1984  
	    map.getProjectionObject() // to Spherical Mercator Projection
	);

    
    if(!hasMoved) {
	count = count + 1;
	if (count % 20 == 0) {
	    if (!zoomlocked) {
		map.setCenter(lonLat, zoomunlock);
	    } else {
		map.setCenter(lonLat);
	    }
	} else {
	    map.panTo(lonLat);
	}
    }
}

/**
 * Update the plane layer so that the plane 
 * is update with the marker of previous location.
 * 
 * @param mapLayer - Open Street Map layer
 * @param featureLayer - Layer that contains Plane.
 * @param features - the tracer marker that's used.
 * 
 * @return - updated plane layer.
 */
function UpdateLayer(mapLayer, featureLayer, features) {

    //setting loaded to false unloads the layer//
    if(mapLayer) {
        mapLayer.loaded = false;
    }

    if(featureLayer) {
        featureLayer.loaded = false;
    }

    //setting visibility to true forces a reload of the layer//
    if(mapLayer) {
        mapLayer.setVisibility(true);
    }

    if(featureLayer) {

        featureLayer.setVisibility(true);
    }

    //the refresh will force it to get the new KML data//
    if(mapLayer) {
        mapLayer.refresh({ force: true, params: { 'key': Math.random()} });
    }

    if(featureLayer) {
        featureLayer.refresh({ force: true, params: { 'key': Math.random()} });
    }
    //- <3 from Thqr -//

    // draw feature if available
    if(feature && featureLayer) {
        for(var i = 0; i < features.length; i++) {
            featureLayer.addFeatures(features[i]); 
        }
    }
}

/**
 * Put a stationary obstacle marker on the map.
 * 
 * @param lon - Longitude of the obstacle.
 * @param lat - Latitude of the obstacle marker.
 * @param height - height of the cylinder
 * @param rad - radius of the cylinder
 * @return - Make obstacle marker appear on the the screen. 
 */
function createStationaryObsticle(lon, lat, height, rad) {

    obst = new OpenLayers.Feature.Vector(
	   new OpenLayers.Geometry.Point( lon, lat ).transform(new OpenLayers.Projection("EPSG:4326"),
	   map.getProjectionObject()),
	       {description: 'Stationary Object'},
	       {externalGraphic:'map_app/img/cylinder_obst.png',
               graphicHeight: (rad*0.8), graphicWidth: (rad*0.8),
	       graphicXOffset:-12, graphicYOffset:-25});

    planeLayer.addFeatures(obst);
}

/**
 * Adds a waypoint icon to the map and lists the icon in a queue
 *
 * @param lon - longitude data of the waypoint
 * @param lat - latitude data of the waypoint
 * @param seq - the numerical sequence that the waypoint is in the flight.
 */
function createWaypoint(lon, lat, seq) {

    console.log(lat + " " + lon)
    
    wayp = new OpenLayers.Feature.Vector(
	      new OpenLayers.Geometry.Point(lon, lat).transform(new OpenLayers.Projection("EPSG:4326"),
              map.getProjectionObject()),
	            {description:'waypoint for xplane'},
	            {externalGraphic:'map_app/img/waypoint.icons/'+seq+'.png',
                    graphicHeight: 25, graphicWidth: 25, graphicXOffset:-16, graphicYOffset:-8});

    //console.log("balooga balooga the big blue whale");

    waypointLayer.addFeatures(wayp);
    UpdateLayer(null, waypointLayer, [wayp]);
}

/**
 * Create a moving obstacle marker on the map.
 * 
 * @param lon - Longitude of the obstacle.
 * @param lat - Latitude of the obstacle marker.
 * @param id - identifufcation for input into array of moving obstacles.
 * @param size - radius of the sphere.
 * @return - Make obstacle marker appear on the the screen.
 */
function createMovingObsticle(lon, lat, size, id) {
    
    obst_mov = new OpenLayers.Feature.Vector(
	       new OpenLayers.Geometry.Point( lon, lat ).transform(new OpenLayers.Projection("EPSG:4326"), 
               map.getProjectionObject()),
		   {description: 'Is an Obstacle'},
		   {externalGraphic:'map_app/img/sphere_obst.png', 
		    graphicHeight: (size*0.8), graphicWidth: (size*0.8), graphicXOffset:-12, graphicYOffset:-25});
    
    // JSON object we use to store obsticle information.
    var ObjectToInsert = {
	"Obsticle": obst_mov,
        "identification" : id,
	"obsticleLocation":[],
	"size":size
    }

    movingObstacles.push(ObjectToInsert);
}

/**
 * Change a moving obstacle that has already been put on the field.
 * 
 * @param lon - Longitude to change the obsticle to
 * @param lat - Latitude to change to obsticle to.
 * @param id - identification of the obsticle to distignuish from others.
 * @param size - radius of the sphere in case the obsticle hasn't been created.
 * @return the obsticle changed to its new position
 */
function changeMovingObsticleLoc(lon, lat, size, id) {
    var curr;
    var containsObstacle = false;
    for (var i = 0; i < movingObstacles.length; i++) {
	if (movingObstacles[i].identification == id) {
	    containsObstacle = true;
	    movingObstacles[i].obsticleLocation.push(movingObstacles.Obsticle);

	    curr = new OpenLayers.Feature.Vector(
		   new OpenLayers.Geometry.Point(lon, lat).transform(new OpenLayers.Projection("EPSG:4326"), 
                       map.getProjectionObject()),
		       {description: id} ,
		       {externalGraphic:'map_app/img/sphere_obst.png', 
                       graphicHeight: (size*2), graphicWidth: (size*2), graphicXOffset:-12, graphicYOffset:-25 });

	    movingObstacles.Obsticle = curr;
	    Obst_Layer.addFeatures(curr);
	    UpdateLayer(Obst_Layer);
	}
	while (movingObstacles[i].obsticleLocation.length >= 11) {
	    Obst_Layer.removeFeatures(movingObstacles[i].obsticleLocation[0]);
	    movingObstacles[i].obsticleLocation.shift();
	}
    }
    
    // If the obstacle hasn't been created previously, then create it.
    if (!containsObstacle) {
	createMovingObsticle(lon, lat, size, id);
    }

}

/**
 * Interop calls this to update obstacle positions
 * 
 * @see _JAM/views/index.html
 * @param Obstaclearr - data sent from the obstacle server contains both moving and stationary obst.
 * @return - Update the obstacle positions based on data.
 */
function arrMovObst(Obstaclearr) {
    if (!StationaryObstBeenCalled) {
        for (var i = 0; i < Obstaclearr.stationary_obstacles.length; i++) {
            createStationaryObsticle(Obstaclearr.stationary_obstacles[i].longitude, 
                                     Obstaclearr.stationary_obstacles[i].latitude,
                                     Obstaclearr.stationary_obstacles[i].cylinder_height,
                                     Obstaclearr.stationary_obstacles[i].cylinder_radius);
        }

        StationaryObstBeenCalled = true;
    }

    for (var i = 0; i < Obstaclearr.moving_obstacles.length; i++) {
        changeMovingObsticleLoc(Obstaclearr.moving_obstacles[i].longitude, 
                                Obstaclearr.moving_obstacles[i].latitude, 
                                Obstaclearr.moving_obstacles[i].sphere_radius, i);
    }
}

/**
 * Function that parses Waypoint JSON Data
 * @params data -- Waypoint JSON Data
 */
function populateWaypoints(data) {
    if (JSON.stringify(data) !== JSON.stringify(currentWaypointSet)) {
	
	waypointLayer.removeAllFeatures();
	
	var param = JSON.parse(data);
	for(var num in param) {
	    obj = param[num];
	    createWaypoint(obj.y, obj.x, num);
	}

	currentWaypointSet = data;

    }
}
