(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
function corslite(url, callback, cors) {
    var sent = false;

    if (typeof window.XMLHttpRequest === 'undefined') {
        return callback(Error('Browser not supported'));
    }

    if (typeof cors === 'undefined') {
        var m = url.match(/^\s*https?:\/\/[^\/]*/);
        cors = m && (m[0] !== location.protocol + '//' + location.hostname +
                (location.port ? ':' + location.port : ''));
    }

    var x = new window.XMLHttpRequest();

    function isSuccessful(status) {
        return status >= 200 && status < 300 || status === 304;
    }

    if (cors && !('withCredentials' in x)) {
        // IE8-9
        x = new window.XDomainRequest();

        // Ensure callback is never called synchronously, i.e., before
        // x.send() returns (this has been observed in the wild).
        // See https://github.com/mapbox/mapbox.js/issues/472
        var original = callback;
        callback = function() {
            if (sent) {
                original.apply(this, arguments);
            } else {
                var that = this, args = arguments;
                setTimeout(function() {
                    original.apply(that, args);
                }, 0);
            }
        }
    }

    function loaded() {
        if (
            // XDomainRequest
            x.status === undefined ||
            // modern browsers
            isSuccessful(x.status)) callback.call(x, null, x);
        else callback.call(x, x, null);
    }

    // Both `onreadystatechange` and `onload` can fire. `onreadystatechange`
    // has [been supported for longer](http://stackoverflow.com/a/9181508/229001).
    if ('onload' in x) {
        x.onload = loaded;
    } else {
        x.onreadystatechange = function readystate() {
            if (x.readyState === 4) {
                loaded();
            }
        };
    }

    // Call the callback with the XMLHttpRequest object as an error and prevent
    // it from ever being called again by reassigning it to `noop`
    x.onerror = function error(evt) {
        // XDomainRequest provides no evt parameter
        callback.call(this, evt || true, null);
        callback = function() { };
    };

    // IE9 must have onprogress be set to a unique function.
    x.onprogress = function() { };

    x.ontimeout = function(evt) {
        callback.call(this, evt, null);
        callback = function() { };
    };

    x.onabort = function(evt) {
        callback.call(this, evt, null);
        callback = function() { };
    };

    // GET is the only supported HTTP Verb by XDomainRequest and is the
    // only one supported here.
    x.open('GET', url, true);

    // Send the request. Sending data is not supported.
    x.send(null);
    sent = true;

    return x;
}

if (typeof module !== 'undefined') module.exports = corslite;

},{}],2:[function(require,module,exports){
(function (global){
/* to do:
make a GIF
why doesnt map load until OAuth user signs in?
doc parameters in a table
round response geometry to 5 decimal places
*/
(function() {
	'use strict';

	var L = (typeof window !== "undefined" ? window['L'] : typeof global !== "undefined" ? global['L'] : null);
	var corslite = require('corslite');

	// Ignore camelcase naming for this file, since OSRM's API uses
	// underscores.
	/* jshint camelcase: false */
  (typeof window !== "undefined" ? window['Routing'] : typeof global !== "undefined" ? global['Routing'] : null);

  var profiles = require('./profiles.js');

	module.exports = L.Class.extend({
    options: {
			// users can supply a proxied url instead of a token
			serviceUrl: 'https://route.arcgis.com/arcgis/rest/services/World/Route/NAServer/Route_World',
			timeout: 30 * 1000,
			routingOptions: {
				profile: 'Driving',
        liveTraffic: true
			}
		},

		initialize: function(options) {
			L.Util.setOptions(this, options);
			this._hints = {
				locations: {}
			};
		},

		route: function(waypoints, callback, context, options) {
			var timedOut = false,
				wps = [],
				url,
				timer,
				wp,
				i,
				xhr;

			options = L.extend({}, this.options.routingOptions, options);
			url = this.buildRouteUrl(waypoints, options);
			if (this.options.requestParameters) {
				url += L.Util.getParamString(this.options.requestParameters, url);
			}

			timer = setTimeout(function() {
				timedOut = true;
				callback.call(context || callback, {
					status: -1,
					message: 'request timed out.'
				});
			}, this.options.timeout);

			// Create a copy of the waypoints, since they
			// might otherwise be asynchronously modified while
			// the request is being processed.
			for (i = 0; i < waypoints.length; i++) {
				wp = waypoints[i];
				wps.push(L.Routing.waypoint(wp.latLng, wp.name, wp.options));
			}

			return xhr = corslite(url, L.bind(function(err, resp) {
				var data,
					error =  {};

				clearTimeout(timer);
				if (!timedOut) {
					if (!err) {
						try {
							data = JSON.parse(resp.responseText);
							try {
								return this._routeDone(data, wps, options, callback, context);
							} catch (ex) {
								error.status = -3;
								error.message = ex.toString();
							}
						} catch (ex) {
							error.status = -2;
							error.message = 'Error parsing response: ' + ex.toString();
						}
					} else {
						error.message = 'HTTP request failed: ' + err.type +
							(err.target && err.target.status ? ' HTTP ' + err.target.status + ': ' + err.target.statusText : '');
						error.url = url;
						error.status = -1;
						error.target = err;
					}

					callback.call(context || callback, error);
				} else {
					xhr.abort();
				}
			}, this));
		},

		requiresMoreDetail: function(route, zoom, bounds) {
			if (!route.properties.isSimplified) {
				return false;
			}

			var waypoints = route.inputWaypoints,
				i;
			for (i = 0; i < waypoints.length; ++i) {
				if (!bounds.contains(waypoints[i].latLng)) {
					return true;
				}
			}

			return false;
		},

		_routeDone: function(response, inputWaypoints, options, callback, context) {
			var alts = [],
			    actualWaypoints,
			    i,
			    route;

			context = context || callback;
			// no error message
			if (response.error && response.error.code == 400) {
				callback.call(context, {
					status: response.code
				});
				return;
			}

			actualWaypoints = this._esriToWaypoints(inputWaypoints, response.stops.features);

			// can the esri service pass back alternate routes? if so, add a loop
			route = this._convertRoute(response.directions[0]);

			route.summary = {
				totalDistance: response.directions[0].summary.totalLength,
				// seconds
				totalTime: response.directions[0].summary.totalTime * 60
			}

			response.routes.features[0]
			route.inputWaypoints = inputWaypoints;
			route.waypoints = actualWaypoints;
			// i have no idea what this does
			route.properties = {isSimplified: !options || !options.geometryOnly || options.simplifyGeometry};

			alts.push(route);
			this._saveHintData(inputWaypoints, inputWaypoints);
			callback.call(context, null, alts);
		},

		_convertRoute: function(responseRoute, summary) {
			var result = {
					coordinates: [],
					instructions: []
				},
				legNames = [],
				waypointIndices = [],
				index = 0,
        // i dont *think* the esri routing service supports alternate routes
        legCount = 1,
				hasSteps = responseRoute.features.length > 0,
				i,
				j,
				leg,
				step,
				geometry,
				type,
				modifier,
				text,
				stepToText;

			for (i = 0; i < legCount; i++) {
				leg = responseRoute.features;
				legNames.push(responseRoute.routeName);
				text = responseRoute.routeName;

				for (j = 0; j < leg.length; j++) {
					step = leg[j];
					geometry = this._esriDecodePolyline(step.compressedGeometry);
					result.coordinates.push.apply(result.coordinates, geometry);
					type = this._esriManeuverToInstructionType(step.attributes, i === legCount - 1);
					modifier = this._esriManeuverToModifier(step.attributes);

					text = step.attributes.text;

					if (step.attributes.maneuverType) {
						if ((i == 0 && step.attributes.maneuverType == 'esriDMTDepart') || step.attributes.maneuverType == 'esriDMTStop') {
							waypointIndices.push(index);
						}
          }

          result.instructions.push({
            type: type,
            distance: step.attributes.length,
            time: step.attributes.time,
            index: index,
            modifier: modifier,
            text: text
            // road: 'placeholder', // step.name,
            // direction: this._bearingToDirection(step.maneuver.bearing_after),
            // exit: step.maneuver.exit,
            // mode: step.mode,
          });

					index += geometry.length;
				}
			}

      // ours service doesnt give stop coordinates real names in summary
			result.name = ''; // legNames.join(', ');

			return result;
		},

		_bearingToDirection: function(bearing) {
			var oct = Math.round(bearing / 45) % 8;
			return ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][oct];
		},

		_esriManeuverToInstructionType: function(attributes, lastLeg) {
			// case 'esriDMTStraight':
			// case 'esriDMTTurnLeft':
			// case 'esriDMTTurnRight':
			switch (attributes.maneuverType) {
			case 'esriDMTDepart':
				return 'Head';
			case 'esriDMTStop':
				return lastLeg ? 'DestinationReached' : 'WaypointReached';
			case 'esriDMTRoundabout':
			case 'rotary':
				return 'Roundabout';
			case 'esriDMTForkLeft':
			case 'esriDMTForkRight':
			case 'esriDMTRampLeft':
			case 'esriDMTRampRight':
			case 'esriDMTSharpLeft':
			case 'esriDMTSharpRight':
				return this._camelCase(attributes.maneuverType);
			default:
				return null
			}
		},

		_esriManeuverToModifier: function(attributes) {
			var modifier;

			switch (attributes.maneuverType) {
			case 'esriDMTDepart':
			case 'esriDMTStraight':
			case 'esriDMTRoundabout':
			case 'esriDMTStop':
			  modifier = null;
				break
			default:
			  modifier = this._leftOrRight(attributes.maneuverType);
			}
			return modifier && this._camelCase(modifier);
		},

		_camelCase: function(s) {
			var words = s.split(' '),
				result = '';
			for (var i = 0, l = words.length; i < l; i++) {
				result += words[i].charAt(0).toUpperCase() + words[i].substring(1);
			}

			return result;
		},

		_leftOrRight: function(d) {
			return d.indexOf('Left') >= 0 ? 'Left' : 'Right';
		},

    // https://github.com/Esri/terraformer-arcgis-parser/issues/10
    _esriDecodePolyline: function(str) {
    var xDiffPrev = 0,
        yDiffPrev = 0,
        points = [],
        x, y,
        strings,
        coefficient;

      // Split the string into an array on the + and - characters
      strings = str.match(/((\+|\-)[^\+\-]+)/g);

      // The first value is the coefficient in base 32
      coefficient = parseInt(strings[0], 32);

      for (var j = 1; j < strings.length; j += 2) {
        // j is the offset for the x value
        // Convert the value from base 32 and add the previous x value
        x = (parseInt(strings[j], 32) + xDiffPrev);
        xDiffPrev = x;

        // j+1 is the offset for the y value
        // Convert the value from base 32 and add the previous y value
        y = (parseInt(strings[j + 1], 32) + yDiffPrev);
        yDiffPrev = y;

        points.push(L.latLng([y / coefficient, x / coefficient]));
      }

      return points;
    },

    _esriToWaypoints: function(inputWaypoints, vias) {
			var wps = [],
			    i,
			    viaLoc;
			for (i = 0; i < vias.length; i++) {
				viaLoc = vias[i].geometry;
				wps.push(L.Routing.waypoint(L.latLng(viaLoc.y, viaLoc.x),
				                            inputWaypoints[i].name,
											inputWaypoints[i].options));
			}

			return wps;
		},

		buildRouteUrl: function(waypoints, options) {
			var locs = [],
				hints = [],
				wp,
				latLng,
			    computeInstructions,
			    computeAlternative = true;

			for (var i = 0; i < waypoints.length; i++) {
				wp = waypoints[i];
				latLng = wp.latLng;
				locs.push(latLng.lng + ',' + latLng.lat);
				hints.push(this._hints.locations[this._locationKey(latLng)] || '');
			}

			// computeInstructions = true;
      var completeServiceUrl = this.options.serviceUrl + '/solve?f=json&returnStops=true&directionsLengthUnits=esriNAUMeters&directionsOutputType=esriDOTComplete';

      if (this.options.liveTraffic) {
        completeServiceUrl += '&startTimeisUTC=true&startTime=' + new Date().getTime();
      }

      if (this.options.profile) {
        completeServiceUrl += '&travelMode=' + profiles[this.options.profile];
      }

      if (this.options.token) {
        completeServiceUrl += '&token=' + this.options.token;
      }

      completeServiceUrl += '&stops=' + locs.join(';');

      return completeServiceUrl;

      // var params = {
      //   f: 'json',
      //   returnStops: true,
      //   directionsLengthUnits: 'esriNAUMeters',
      //   directionsOutputType: 'esriDOTComplete'
      // };
      //
      // if (this.options.liveTraffic) {
      //   params.startTimeisUTC = true
      //   params.startTime = new Date().getTime()
      // }
      //
      // params.travelMode = profiles[this.options.profile]
      // params.stops = locs.join(';');
      //
      // return params;
		},

		_locationKey: function(location) {
			return location.lat + ',' + location.lng;
		},

		_saveHintData: function(actualWaypoints, waypoints) {
			var loc;
			this._hints = {
				locations: {}
			};
			for (var i = actualWaypoints.length - 1; i >= 0; i--) {
				loc = waypoints[i].latLng;
				this._hints.locations[this._locationKey(loc)] = actualWaypoints[i].hint;
			}
		},
	});
})();

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"./profiles.js":4,"corslite":1}],3:[function(require,module,exports){
(function (global){
var L = (typeof window !== "undefined" ? window['L'] : typeof global !== "undefined" ? global['L'] : null);
var EsriRouter = require('./esriRouter');

L.Routing = L.Routing || {};
L.routing = L.routing || {};

L.Routing.Esri = EsriRouter;

L.routing.esri = function(key, options) {
  return new EsriRouter(key, options);
}

// deprecate this later
L.Routing.esri = L.routing.esri;

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"./esriRouter":2}],4:[function(require,module,exports){
module.exports = {
  "Driving" : '{"attributeParameterValues":[{"parameterName":"Restriction Usage","attributeName":"Avoid Unpaved Roads","value":"AVOID_HIGH"},{"parameterName":"Restriction Usage","attributeName":"Avoid Private Roads","value":"AVOID_MEDIUM"},{"parameterName":"Restriction Usage","attributeName":"Driving an Automobile","value":"PROHIBITED"},{"parameterName":"Restriction Usage","attributeName":"Through Traffic Prohibited","value":"AVOID_HIGH"},{"parameterName":"Restriction Usage","attributeName":"Roads Under Construction Prohibited","value":"PROHIBITED"},{"parameterName":"Restriction Usage","attributeName":"Avoid Gates","value":"AVOID_MEDIUM"},{"parameterName":"Restriction Usage","attributeName":"Avoid Express Lanes","value":"PROHIBITED"},{"parameterName":"Restriction Usage","attributeName":"Avoid Carpool Roads","value":"PROHIBITED"}],"description":"Models the movement of cars and other similar small automobiles, such as pickup trucks, and finds solutions that optimize travel time. Travel obeys one-way roads, avoids illegal turns, and follows other rules that are specific to cars. Dynamic travel speeds based on traffic are used where it is available when you specify a start time.","impedanceAttributeName":"TravelTime","simplificationToleranceUnits":"esriMeters","uturnAtJunctions":"esriNFSBAtDeadEndsAndIntersections","restrictionAttributeNames":["Avoid Unpaved Roads","Avoid Private Roads","Driving an Automobile","Through Traffic Prohibited","Roads Under Construction Prohibited","Avoid Gates","Avoid Express Lanes","Avoid Carpool Roads"],"useHierarchy":true,"simplificationTolerance":10,"timeAttributeName":"TravelTime","distanceAttributeName":"Kilometers","type":"AUTOMOBILE","id":"FEgifRtFndKNcJMJ","name":"Driving Time"}',
  "Driving Distance": '{"attributeParameterValues":[{"parameterName":"Restriction Usage","attributeName":"Avoid Unpaved Roads","value":"AVOID_HIGH"},{"parameterName":"Restriction Usage","attributeName":"Avoid Private Roads","value":"AVOID_MEDIUM"},{"parameterName":"Restriction Usage","attributeName":"Driving an Automobile","value":"PROHIBITED"},{"parameterName":"Restriction Usage","attributeName":"Through Traffic Prohibited","value":"AVOID_HIGH"},{"parameterName":"Restriction Usage","attributeName":"Roads Under Construction Prohibited","value":"PROHIBITED"},{"parameterName":"Restriction Usage","attributeName":"Avoid Gates","value":"AVOID_MEDIUM"},{"parameterName":"Restriction Usage","attributeName":"Avoid Express Lanes","value":"PROHIBITED"},{"parameterName":"Restriction Usage","attributeName":"Avoid Carpool Roads","value":"PROHIBITED"}],"description":"Models the movement of cars and other similar small automobiles, such as pickup trucks, and finds solutions that optimize travel distance. Travel obeys one-way roads, avoids illegal turns, and follows other rules that are specific to cars.","impedanceAttributeName":"Kilometers","simplificationToleranceUnits":"esriMeters","uturnAtJunctions":"esriNFSBAtDeadEndsAndIntersections","restrictionAttributeNames":["Avoid Unpaved Roads","Avoid Private Roads","Driving an Automobile","Through Traffic Prohibited","Roads Under Construction Prohibited","Avoid Gates","Avoid Express Lanes","Avoid Carpool Roads"],"useHierarchy":true,"simplificationTolerance":10,"timeAttributeName":"TravelTime","distanceAttributeName":"Kilometers","type":"AUTOMOBILE","id":"iKjmHuBSIqdEfOVr","name":"Driving Distance"}',
  "Trucking": '{"attributeParameterValues":[{"parameterName":"Restriction Usage","attributeName":"Use Preferred Truck Routes","value":"PREFER_HIGH"},{"parameterName":"Restriction Usage","attributeName":"Avoid Unpaved Roads","value":"AVOID_HIGH"},{"parameterName":"Restriction Usage","attributeName":"Avoid Private Roads","value":"AVOID_MEDIUM"},{"parameterName":"Restriction Usage","attributeName":"Driving a Truck","value":"PROHIBITED"},{"parameterName":"Restriction Usage","attributeName":"Roads Under Construction Prohibited","value":"PROHIBITED"},{"parameterName":"Restriction Usage","attributeName":"Avoid Gates","value":"AVOID_MEDIUM"},{"parameterName":"Restriction Usage","attributeName":"Avoid Express Lanes","value":"PROHIBITED"},{"parameterName":"Restriction Usage","attributeName":"Avoid Carpool Roads","value":"PROHIBITED"},{"parameterName":"Restriction Usage","attributeName":"Avoid Truck Restricted Roads","value":"AVOID_HIGH"}],"description":"Models basic truck travel by preferring designated truck routes, and finds solutions that optimize travel time. Routes must obey one-way roads, avoid illegal turns, and so on.","impedanceAttributeName":"TruckTravelTime","simplificationToleranceUnits":"esriMeters","uturnAtJunctions":"esriNFSBNoBacktrack","restrictionAttributeNames":["Avoid Carpool Roads","Avoid Express Lanes","Avoid Gates","Avoid Private Roads","Avoid Truck Restricted Roads","Avoid Unpaved Roads","Driving a Truck","Roads Under Construction Prohibited","Use Preferred Truck Routes"],"useHierarchy":true,"simplificationTolerance":10,"timeAttributeName":"TruckTravelTime","distanceAttributeName":"Kilometers","type":"TRUCK","id":"ZzzRtYcPLjXFBKwr","name":"Trucking Time"}',
  "Trucking Distance": '{"attributeParameterValues":[{"parameterName":"Restriction Usage","attributeName":"Use Preferred Truck Routes","value":"PREFER_HIGH"},{"parameterName":"Restriction Usage","attributeName":"Avoid Unpaved Roads","value":"AVOID_HIGH"},{"parameterName":"Restriction Usage","attributeName":"Avoid Private Roads","value":"AVOID_MEDIUM"},{"parameterName":"Restriction Usage","attributeName":"Driving a Truck","value":"PROHIBITED"},{"parameterName":"Restriction Usage","attributeName":"Roads Under Construction Prohibited","value":"PROHIBITED"},{"parameterName":"Restriction Usage","attributeName":"Avoid Gates","value":"AVOID_MEDIUM"},{"parameterName":"Restriction Usage","attributeName":"Avoid Express Lanes","value":"PROHIBITED"},{"parameterName":"Restriction Usage","attributeName":"Avoid Carpool Roads","value":"PROHIBITED"},{"parameterName":"Restriction Usage","attributeName":"Avoid Truck Restricted Roads","value":"AVOID_HIGH"}],"description":"Models basic truck travel by preferring designated truck routes, and finds solutions that optimize travel distance. Routes must obey one-way roads, avoid illegal turns, and so on.","impedanceAttributeName":"Kilometers","simplificationToleranceUnits":"esriMeters","uturnAtJunctions":"esriNFSBNoBacktrack","restrictionAttributeNames":["Avoid Carpool Roads","Avoid Express Lanes","Avoid Gates","Avoid Private Roads","Avoid Truck Restricted Roads","Avoid Unpaved Roads","Driving a Truck","Roads Under Construction Prohibited","Use Preferred Truck Routes"],"useHierarchy":true,"simplificationTolerance":10,"timeAttributeName":"TruckTravelTime","distanceAttributeName":"Kilometers","type":"TRUCK","id":"UBaNfFWeKcrRVYIo","name":"Trucking Distance"}',
  "Walking" : '{"attributeParameterValues":[{"parameterName":"Restriction Usage","attributeName":"Avoid Private Roads","value":"AVOID_MEDIUM"},{"parameterName":"Restriction Usage","attributeName":"Walking","value":"PROHIBITED"},{"parameterName":"Restriction Usage","attributeName":"Preferred for Pedestrians","value":"PREFER_LOW"},{"parameterName":"Walking Speed (km/h)","attributeName":"WalkTime","value":5},{"parameterName":"Restriction Usage","attributeName":"Avoid Roads Unsuitable for Pedestrians","value":"AVOID_HIGH"}],"description":"Follows paths and roads that allow pedestrian traffic and finds solutions that optimize travel time. The walking speed is set to 5 kilometers per hour.","impedanceAttributeName":"WalkTime","simplificationToleranceUnits":"esriMeters","uturnAtJunctions":"esriNFSBAllowBacktrack","restrictionAttributeNames":["Avoid Private Roads","Avoid Roads Unsuitable for Pedestrians","Preferred for Pedestrians","Walking"],"useHierarchy":false,"simplificationTolerance":2,"timeAttributeName":"WalkTime","distanceAttributeName":"Kilometers","type":"WALK","id":"caFAgoThrvUpkFBW","name":"Walking Time"}',
  "Walking Distance": '{"attributeParameterValues":[{"parameterName":"Restriction Usage","attributeName":"Avoid Private Roads","value":"AVOID_MEDIUM"},{"parameterName":"Restriction Usage","attributeName":"Walking","value":"PROHIBITED"},{"parameterName":"Restriction Usage","attributeName":"Preferred for Pedestrians","value":"PREFER_LOW"},{"parameterName":"Walking Speed (km/h)","attributeName":"WalkTime","value":5},{"parameterName":"Restriction Usage","attributeName":"Avoid Roads Unsuitable for Pedestrians","value":"AVOID_HIGH"}],"description":"Follows paths and roads that allow pedestrian traffic and finds solutions that optimize travel distance.","impedanceAttributeName":"Kilometers","simplificationToleranceUnits":"esriMeters","uturnAtJunctions":"esriNFSBAllowBacktrack","restrictionAttributeNames":["Avoid Private Roads","Avoid Roads Unsuitable for Pedestrians","Preferred for Pedestrians","Walking"],"useHierarchy":false,"simplificationTolerance":2,"timeAttributeName":"WalkTime","distanceAttributeName":"Kilometers","type":"WALK","id":"yFuMFwIYblqKEefX","name":"Walking Distance"}',
  "Rural Driving": '{"attributeParameterValues":[{"parameterName":"Restriction Usage","attributeName":"Avoid Private Roads","value":"AVOID_MEDIUM"},{"parameterName":"Restriction Usage","attributeName":"Driving an Automobile","value":"PROHIBITED"},{"parameterName":"Restriction Usage","attributeName":"Through Traffic Prohibited","value":"AVOID_HIGH"},{"parameterName":"Restriction Usage","attributeName":"Roads Under Construction Prohibited","value":"PROHIBITED"},{"parameterName":"Restriction Usage","attributeName":"Avoid Gates","value":"AVOID_MEDIUM"},{"parameterName":"Restriction Usage","attributeName":"Avoid Express Lanes","value":"PROHIBITED"},{"parameterName":"Restriction Usage","attributeName":"Avoid Carpool Roads","value":"PROHIBITED"}],"description":"Models the movement of cars and other similar small automobiles, such as pickup trucks, and finds solutions that optimize travel time. Travel obeys one-way roads, avoids illegal turns, and follows other rules that are specific to cars, but does not discourage travel on unpaved roads. Dynamic travel speeds based on traffic are used where it is available when you specify a start time.","impedanceAttributeName":"TravelTime","simplificationToleranceUnits":"esriMeters","uturnAtJunctions":"esriNFSBAtDeadEndsAndIntersections","restrictionAttributeNames":["Avoid Carpool Roads","Avoid Express Lanes","Avoid Gates","Avoid Private Roads","Driving an Automobile","Roads Under Construction Prohibited","Through Traffic Prohibited"],"useHierarchy":true,"simplificationTolerance":10,"timeAttributeName":"TravelTime","distanceAttributeName":"Kilometers","type":"AUTOMOBILE","id":"NmNhNDUwZmE1YTlj","name":"Rural Driving Time"}',
  "Rural Driving Distance" : '{"attributeParameterValues":[{"parameterName":"Restriction Usage","attributeName":"Avoid Private Roads","value":"AVOID_MEDIUM"},{"parameterName":"Restriction Usage","attributeName":"Driving an Automobile","value":"PROHIBITED"},{"parameterName":"Restriction Usage","attributeName":"Through Traffic Prohibited","value":"AVOID_HIGH"},{"parameterName":"Restriction Usage","attributeName":"Roads Under Construction Prohibited","value":"PROHIBITED"},{"parameterName":"Restriction Usage","attributeName":"Avoid Gates","value":"AVOID_MEDIUM"},{"parameterName":"Restriction Usage","attributeName":"Avoid Express Lanes","value":"PROHIBITED"},{"parameterName":"Restriction Usage","attributeName":"Avoid Carpool Roads","value":"PROHIBITED"}],"description":"Models the movement of cars and other similar small automobiles, such as pickup trucks, and finds solutions that optimize travel distance. Travel obeys one-way roads, avoids illegal turns, and follows other rules that are specific to cars, but does not discourage travel on unpaved roads.","impedanceAttributeName":"Kilometers","simplificationToleranceUnits":"esriMeters","uturnAtJunctions":"esriNFSBAtDeadEndsAndIntersections","restrictionAttributeNames":["Avoid Carpool Roads","Avoid Express Lanes","Avoid Gates","Avoid Private Roads","Driving an Automobile","Roads Under Construction Prohibited","Through Traffic Prohibited"],"useHierarchy":true,"simplificationTolerance":10,"timeAttributeName":"TravelTime","distanceAttributeName":"Kilometers","type":"AUTOMOBILE","id":"Yzk3NjI1NTU5NjVj","name":"Rural Driving Distance"}'
}

},{}]},{},[2,3,4]);
