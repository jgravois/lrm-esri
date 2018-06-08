(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
'use strict';

var isCallable = require('is-callable');

var toStr = Object.prototype.toString;
var hasOwnProperty = Object.prototype.hasOwnProperty;

var forEachArray = function forEachArray(array, iterator, receiver) {
    for (var i = 0, len = array.length; i < len; i++) {
        if (hasOwnProperty.call(array, i)) {
            if (receiver == null) {
                iterator(array[i], i, array);
            } else {
                iterator.call(receiver, array[i], i, array);
            }
        }
    }
};

var forEachString = function forEachString(string, iterator, receiver) {
    for (var i = 0, len = string.length; i < len; i++) {
        // no such thing as a sparse string.
        if (receiver == null) {
            iterator(string.charAt(i), i, string);
        } else {
            iterator.call(receiver, string.charAt(i), i, string);
        }
    }
};

var forEachObject = function forEachObject(object, iterator, receiver) {
    for (var k in object) {
        if (hasOwnProperty.call(object, k)) {
            if (receiver == null) {
                iterator(object[k], k, object);
            } else {
                iterator.call(receiver, object[k], k, object);
            }
        }
    }
};

var forEach = function forEach(list, iterator, thisArg) {
    if (!isCallable(iterator)) {
        throw new TypeError('iterator must be a function');
    }

    var receiver;
    if (arguments.length >= 3) {
        receiver = thisArg;
    }

    if (toStr.call(list) === '[object Array]') {
        forEachArray(list, iterator, receiver);
    } else if (typeof list === 'string') {
        forEachString(list, iterator, receiver);
    } else {
        forEachObject(list, iterator, receiver);
    }
};

module.exports = forEach;

},{"is-callable":3}],2:[function(require,module,exports){
(function (global){
var win;

if (typeof window !== "undefined") {
    win = window;
} else if (typeof global !== "undefined") {
    win = global;
} else if (typeof self !== "undefined"){
    win = self;
} else {
    win = {};
}

module.exports = win;

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],3:[function(require,module,exports){
'use strict';

var fnToStr = Function.prototype.toString;

var constructorRegex = /^\s*class /;
var isES6ClassFn = function isES6ClassFn(value) {
	try {
		var fnStr = fnToStr.call(value);
		var singleStripped = fnStr.replace(/\/\/.*\n/g, '');
		var multiStripped = singleStripped.replace(/\/\*[.\s\S]*\*\//g, '');
		var spaceStripped = multiStripped.replace(/\n/mg, ' ').replace(/ {2}/g, ' ');
		return constructorRegex.test(spaceStripped);
	} catch (e) {
		return false; // not a function
	}
};

var tryFunctionObject = function tryFunctionObject(value) {
	try {
		if (isES6ClassFn(value)) { return false; }
		fnToStr.call(value);
		return true;
	} catch (e) {
		return false;
	}
};
var toStr = Object.prototype.toString;
var fnClass = '[object Function]';
var genClass = '[object GeneratorFunction]';
var hasToStringTag = typeof Symbol === 'function' && typeof Symbol.toStringTag === 'symbol';

module.exports = function isCallable(value) {
	if (!value) { return false; }
	if (typeof value !== 'function' && typeof value !== 'object') { return false; }
	if (hasToStringTag) { return tryFunctionObject(value); }
	if (isES6ClassFn(value)) { return false; }
	var strClass = toStr.call(value);
	return strClass === fnClass || strClass === genClass;
};

},{}],4:[function(require,module,exports){
module.exports = isFunction

var toString = Object.prototype.toString

function isFunction (fn) {
  var string = toString.call(fn)
  return string === '[object Function]' ||
    (typeof fn === 'function' && string !== '[object RegExp]') ||
    (typeof window !== 'undefined' &&
     // IE8 and below
     (fn === window.setTimeout ||
      fn === window.alert ||
      fn === window.confirm ||
      fn === window.prompt))
};

},{}],5:[function(require,module,exports){
var trim = require('trim')
  , forEach = require('for-each')
  , isArray = function(arg) {
      return Object.prototype.toString.call(arg) === '[object Array]';
    }

module.exports = function (headers) {
  if (!headers)
    return {}

  var result = {}

  forEach(
      trim(headers).split('\n')
    , function (row) {
        var index = row.indexOf(':')
          , key = trim(row.slice(0, index)).toLowerCase()
          , value = trim(row.slice(index + 1))

        if (typeof(result[key]) === 'undefined') {
          result[key] = value
        } else if (isArray(result[key])) {
          result[key].push(value)
        } else {
          result[key] = [ result[key], value ]
        }
      }
  )

  return result
}
},{"for-each":1,"trim":6}],6:[function(require,module,exports){

exports = module.exports = trim;

function trim(str){
  return str.replace(/^\s*|\s*$/g, '');
}

exports.left = function(str){
  return str.replace(/^\s*/, '');
};

exports.right = function(str){
  return str.replace(/\s*$/, '');
};

},{}],7:[function(require,module,exports){
"use strict";
var window = require("global/window")
var isFunction = require("is-function")
var parseHeaders = require("parse-headers")
var xtend = require("xtend")

module.exports = createXHR
// Allow use of default import syntax in TypeScript
module.exports.default = createXHR;
createXHR.XMLHttpRequest = window.XMLHttpRequest || noop
createXHR.XDomainRequest = "withCredentials" in (new createXHR.XMLHttpRequest()) ? createXHR.XMLHttpRequest : window.XDomainRequest

forEachArray(["get", "put", "post", "patch", "head", "delete"], function(method) {
    createXHR[method === "delete" ? "del" : method] = function(uri, options, callback) {
        options = initParams(uri, options, callback)
        options.method = method.toUpperCase()
        return _createXHR(options)
    }
})

function forEachArray(array, iterator) {
    for (var i = 0; i < array.length; i++) {
        iterator(array[i])
    }
}

function isEmpty(obj){
    for(var i in obj){
        if(obj.hasOwnProperty(i)) return false
    }
    return true
}

function initParams(uri, options, callback) {
    var params = uri

    if (isFunction(options)) {
        callback = options
        if (typeof uri === "string") {
            params = {uri:uri}
        }
    } else {
        params = xtend(options, {uri: uri})
    }

    params.callback = callback
    return params
}

function createXHR(uri, options, callback) {
    options = initParams(uri, options, callback)
    return _createXHR(options)
}

function _createXHR(options) {
    if(typeof options.callback === "undefined"){
        throw new Error("callback argument missing")
    }

    var called = false
    var callback = function cbOnce(err, response, body){
        if(!called){
            called = true
            options.callback(err, response, body)
        }
    }

    function readystatechange() {
        if (xhr.readyState === 4) {
            setTimeout(loadFunc, 0)
        }
    }

    function getBody() {
        // Chrome with requestType=blob throws errors arround when even testing access to responseText
        var body = undefined

        if (xhr.response) {
            body = xhr.response
        } else {
            body = xhr.responseText || getXml(xhr)
        }

        if (isJson) {
            try {
                body = JSON.parse(body)
            } catch (e) {}
        }

        return body
    }

    function errorFunc(evt) {
        clearTimeout(timeoutTimer)
        if(!(evt instanceof Error)){
            evt = new Error("" + (evt || "Unknown XMLHttpRequest Error") )
        }
        evt.statusCode = 0
        return callback(evt, failureResponse)
    }

    // will load the data & process the response in a special response object
    function loadFunc() {
        if (aborted) return
        var status
        clearTimeout(timeoutTimer)
        if(options.useXDR && xhr.status===undefined) {
            //IE8 CORS GET successful response doesn't have a status field, but body is fine
            status = 200
        } else {
            status = (xhr.status === 1223 ? 204 : xhr.status)
        }
        var response = failureResponse
        var err = null

        if (status !== 0){
            response = {
                body: getBody(),
                statusCode: status,
                method: method,
                headers: {},
                url: uri,
                rawRequest: xhr
            }
            if(xhr.getAllResponseHeaders){ //remember xhr can in fact be XDR for CORS in IE
                response.headers = parseHeaders(xhr.getAllResponseHeaders())
            }
        } else {
            err = new Error("Internal XMLHttpRequest Error")
        }
        return callback(err, response, response.body)
    }

    var xhr = options.xhr || null

    if (!xhr) {
        if (options.cors || options.useXDR) {
            xhr = new createXHR.XDomainRequest()
        }else{
            xhr = new createXHR.XMLHttpRequest()
        }
    }

    var key
    var aborted
    var uri = xhr.url = options.uri || options.url
    var method = xhr.method = options.method || "GET"
    var body = options.body || options.data
    var headers = xhr.headers = options.headers || {}
    var sync = !!options.sync
    var isJson = false
    var timeoutTimer
    var failureResponse = {
        body: undefined,
        headers: {},
        statusCode: 0,
        method: method,
        url: uri,
        rawRequest: xhr
    }

    if ("json" in options && options.json !== false) {
        isJson = true
        headers["accept"] || headers["Accept"] || (headers["Accept"] = "application/json") //Don't override existing accept header declared by user
        if (method !== "GET" && method !== "HEAD") {
            headers["content-type"] || headers["Content-Type"] || (headers["Content-Type"] = "application/json") //Don't override existing accept header declared by user
            body = JSON.stringify(options.json === true ? body : options.json)
        }
    }

    xhr.onreadystatechange = readystatechange
    xhr.onload = loadFunc
    xhr.onerror = errorFunc
    // IE9 must have onprogress be set to a unique function.
    xhr.onprogress = function () {
        // IE must die
    }
    xhr.onabort = function(){
        aborted = true;
    }
    xhr.ontimeout = errorFunc
    xhr.open(method, uri, !sync, options.username, options.password)
    //has to be after open
    if(!sync) {
        xhr.withCredentials = !!options.withCredentials
    }
    // Cannot set timeout with sync request
    // not setting timeout on the xhr object, because of old webkits etc. not handling that correctly
    // both npm's request and jquery 1.x use this kind of timeout, so this is being consistent
    if (!sync && options.timeout > 0 ) {
        timeoutTimer = setTimeout(function(){
            if (aborted) return
            aborted = true//IE9 may still call readystatechange
            xhr.abort("timeout")
            var e = new Error("XMLHttpRequest timeout")
            e.code = "ETIMEDOUT"
            errorFunc(e)
        }, options.timeout )
    }

    if (xhr.setRequestHeader) {
        for(key in headers){
            if(headers.hasOwnProperty(key)){
                xhr.setRequestHeader(key, headers[key])
            }
        }
    } else if (options.headers && !isEmpty(options.headers)) {
        throw new Error("Headers cannot be set on an XDomainRequest object")
    }

    if ("responseType" in options) {
        xhr.responseType = options.responseType
    }

    if ("beforeSend" in options &&
        typeof options.beforeSend === "function"
    ) {
        options.beforeSend(xhr)
    }

    // Microsoft Edge browser sends "undefined" when send is called with undefined value.
    // XMLHttpRequest spec says to pass null as body to indicate no body
    // See https://github.com/naugtur/xhr/issues/100.
    xhr.send(body || null)

    return xhr


}

function getXml(xhr) {
    // xhr.responseXML will throw Exception "InvalidStateError" or "DOMException"
    // See https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest/responseXML.
    try {
        if (xhr.responseType === "document") {
            return xhr.responseXML
        }
        var firefoxBugTakenEffect = xhr.responseXML && xhr.responseXML.documentElement.nodeName === "parsererror"
        if (xhr.responseType === "" && !firefoxBugTakenEffect) {
            return xhr.responseXML
        }
    } catch (e) {}

    return null
}

function noop() {}

},{"global/window":2,"is-function":4,"parse-headers":5,"xtend":8}],8:[function(require,module,exports){
module.exports = extend

var hasOwnProperty = Object.prototype.hasOwnProperty;

function extend() {
    var target = {}

    for (var i = 0; i < arguments.length; i++) {
        var source = arguments[i]

        for (var key in source) {
            if (hasOwnProperty.call(source, key)) {
                target[key] = source[key]
            }
        }
    }

    return target
}

},{}],9:[function(require,module,exports){
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
	var xhr = require('xhr');
	
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
				body
				// xhr;

			options = L.extend({}, this.options.routingOptions, options);
			url = this.options.serviceUrl + '/solve';
			
			body = this.buildRouteUrl(waypoints, options);
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

			return xhr({
			  method: "post",
			  uri: url,
			  body: body,
			  headers: {
			    "Content-Type": "application/x-www-form-urlencoded"
			  }
			}, L.bind(function(err, resp) {
				var data,
					error =  {};

				clearTimeout(timer);
				if (!timedOut) {
					if (!err) {
						try {
							data = JSON.parse(resp.body);
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
			// var completeServiceUrl = this.options.serviceUrl + '/solve';

			var params = "f=json";
			params += "&returnStops=true";
			params += "&directionsLengthUnits=esriNAUMeters";
			params += "&directionsOutputType=esriDOTComplete";

			if (this.options.liveTraffic) {
				params += "&startTimeisUTC=true";
				params += "&startTime=" + new Date().getTime();
			}

			if (this.options.profile) {
				params += "&travelMode=" + profiles[this.options.profile];
			}

			if (this.options.token) {
				params += "&token=" + this.options.token;
			}

			params += "&stops=" + locs.join(';');

			return params;
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
},{"./profiles.js":11,"xhr":7}],10:[function(require,module,exports){
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
},{"./esriRouter":9}],11:[function(require,module,exports){
module.exports = {
  "Driving" : '{"attributeParameterValues":[{"parameterName":"Restriction Usage","attributeName":"Avoid Unpaved Roads","value":"AVOID_HIGH"},{"parameterName":"Restriction Usage","attributeName":"Avoid Private Roads","value":"AVOID_MEDIUM"},{"parameterName":"Restriction Usage","attributeName":"Driving an Automobile","value":"PROHIBITED"},{"parameterName":"Restriction Usage","attributeName":"Through Traffic Prohibited","value":"AVOID_HIGH"},{"parameterName":"Restriction Usage","attributeName":"Roads Under Construction Prohibited","value":"PROHIBITED"},{"parameterName":"Restriction Usage","attributeName":"Avoid Gates","value":"AVOID_MEDIUM"},{"parameterName":"Restriction Usage","attributeName":"Avoid Express Lanes","value":"PROHIBITED"},{"parameterName":"Restriction Usage","attributeName":"Avoid Carpool Roads","value":"PROHIBITED"}],"description":"Models the movement of cars and other similar small automobiles, such as pickup trucks, and finds solutions that optimize travel time. Travel obeys one-way roads, avoids illegal turns, and follows other rules that are specific to cars. Dynamic travel speeds based on traffic are used where it is available when you specify a start time.","impedanceAttributeName":"TravelTime","simplificationToleranceUnits":"esriMeters","uturnAtJunctions":"esriNFSBAtDeadEndsAndIntersections","restrictionAttributeNames":["Avoid Unpaved Roads","Avoid Private Roads","Driving an Automobile","Through Traffic Prohibited","Roads Under Construction Prohibited","Avoid Gates","Avoid Express Lanes","Avoid Carpool Roads"],"useHierarchy":true,"simplificationTolerance":10,"timeAttributeName":"TravelTime","distanceAttributeName":"Kilometers","type":"AUTOMOBILE","id":"FEgifRtFndKNcJMJ","name":"Driving Time"}',
  "Driving Distance": '{"attributeParameterValues":[{"parameterName":"Restriction Usage","attributeName":"Avoid Unpaved Roads","value":"AVOID_HIGH"},{"parameterName":"Restriction Usage","attributeName":"Avoid Private Roads","value":"AVOID_MEDIUM"},{"parameterName":"Restriction Usage","attributeName":"Driving an Automobile","value":"PROHIBITED"},{"parameterName":"Restriction Usage","attributeName":"Through Traffic Prohibited","value":"AVOID_HIGH"},{"parameterName":"Restriction Usage","attributeName":"Roads Under Construction Prohibited","value":"PROHIBITED"},{"parameterName":"Restriction Usage","attributeName":"Avoid Gates","value":"AVOID_MEDIUM"},{"parameterName":"Restriction Usage","attributeName":"Avoid Express Lanes","value":"PROHIBITED"},{"parameterName":"Restriction Usage","attributeName":"Avoid Carpool Roads","value":"PROHIBITED"}],"description":"Models the movement of cars and other similar small automobiles, such as pickup trucks, and finds solutions that optimize travel distance. Travel obeys one-way roads, avoids illegal turns, and follows other rules that are specific to cars.","impedanceAttributeName":"Kilometers","simplificationToleranceUnits":"esriMeters","uturnAtJunctions":"esriNFSBAtDeadEndsAndIntersections","restrictionAttributeNames":["Avoid Unpaved Roads","Avoid Private Roads","Driving an Automobile","Through Traffic Prohibited","Roads Under Construction Prohibited","Avoid Gates","Avoid Express Lanes","Avoid Carpool Roads"],"useHierarchy":true,"simplificationTolerance":10,"timeAttributeName":"TravelTime","distanceAttributeName":"Kilometers","type":"AUTOMOBILE","id":"iKjmHuBSIqdEfOVr","name":"Driving Distance"}',
  "Trucking": '{"attributeParameterValues":[{"parameterName":"Restriction Usage","attributeName":"Use Preferred Truck Routes","value":"PREFER_HIGH"},{"parameterName":"Restriction Usage","attributeName":"Avoid Unpaved Roads","value":"AVOID_HIGH"},{"parameterName":"Restriction Usage","attributeName":"Avoid Private Roads","value":"AVOID_MEDIUM"},{"parameterName":"Restriction Usage","attributeName":"Driving a Truck","value":"PROHIBITED"},{"parameterName":"Restriction Usage","attributeName":"Roads Under Construction Prohibited","value":"PROHIBITED"},{"parameterName":"Restriction Usage","attributeName":"Avoid Gates","value":"AVOID_MEDIUM"},{"parameterName":"Restriction Usage","attributeName":"Avoid Express Lanes","value":"PROHIBITED"},{"parameterName":"Restriction Usage","attributeName":"Avoid Carpool Roads","value":"PROHIBITED"},{"parameterName":"Restriction Usage","attributeName":"Avoid Truck Restricted Roads","value":"AVOID_HIGH"}],"description":"Models basic truck travel by preferring designated truck routes, and finds solutions that optimize travel time. Routes must obey one-way roads, avoid illegal turns, and so on.","impedanceAttributeName":"TruckTravelTime","simplificationToleranceUnits":"esriMeters","uturnAtJunctions":"esriNFSBNoBacktrack","restrictionAttributeNames":["Avoid Carpool Roads","Avoid Express Lanes","Avoid Gates","Avoid Private Roads","Avoid Truck Restricted Roads","Avoid Unpaved Roads","Driving a Truck","Roads Under Construction Prohibited","Use Preferred Truck Routes"],"useHierarchy":true,"simplificationTolerance":10,"timeAttributeName":"TruckTravelTime","distanceAttributeName":"Kilometers","type":"TRUCK","id":"ZzzRtYcPLjXFBKwr","name":"Trucking Time"}',
  "Trucking Distance": '{"attributeParameterValues":[{"parameterName":"Restriction Usage","attributeName":"Use Preferred Truck Routes","value":"PREFER_HIGH"},{"parameterName":"Restriction Usage","attributeName":"Avoid Unpaved Roads","value":"AVOID_HIGH"},{"parameterName":"Restriction Usage","attributeName":"Avoid Private Roads","value":"AVOID_MEDIUM"},{"parameterName":"Restriction Usage","attributeName":"Driving a Truck","value":"PROHIBITED"},{"parameterName":"Restriction Usage","attributeName":"Roads Under Construction Prohibited","value":"PROHIBITED"},{"parameterName":"Restriction Usage","attributeName":"Avoid Gates","value":"AVOID_MEDIUM"},{"parameterName":"Restriction Usage","attributeName":"Avoid Express Lanes","value":"PROHIBITED"},{"parameterName":"Restriction Usage","attributeName":"Avoid Carpool Roads","value":"PROHIBITED"},{"parameterName":"Restriction Usage","attributeName":"Avoid Truck Restricted Roads","value":"AVOID_HIGH"}],"description":"Models basic truck travel by preferring designated truck routes, and finds solutions that optimize travel distance. Routes must obey one-way roads, avoid illegal turns, and so on.","impedanceAttributeName":"Kilometers","simplificationToleranceUnits":"esriMeters","uturnAtJunctions":"esriNFSBNoBacktrack","restrictionAttributeNames":["Avoid Carpool Roads","Avoid Express Lanes","Avoid Gates","Avoid Private Roads","Avoid Truck Restricted Roads","Avoid Unpaved Roads","Driving a Truck","Roads Under Construction Prohibited","Use Preferred Truck Routes"],"useHierarchy":true,"simplificationTolerance":10,"timeAttributeName":"TruckTravelTime","distanceAttributeName":"Kilometers","type":"TRUCK","id":"UBaNfFWeKcrRVYIo","name":"Trucking Distance"}',
  "Walking" : '{"attributeParameterValues":[{"parameterName":"Restriction Usage","attributeName":"Avoid Private Roads","value":"AVOID_MEDIUM"},{"parameterName":"Restriction Usage","attributeName":"Walking","value":"PROHIBITED"},{"parameterName":"Restriction Usage","attributeName":"Preferred for Pedestrians","value":"PREFER_LOW"},{"parameterName":"Walking Speed (km/h)","attributeName":"WalkTime","value":5},{"parameterName":"Restriction Usage","attributeName":"Avoid Roads Unsuitable for Pedestrians","value":"AVOID_HIGH"}],"description":"Follows paths and roads that allow pedestrian traffic and finds solutions that optimize travel time. The walking speed is set to 5 kilometers per hour.","impedanceAttributeName":"WalkTime","simplificationToleranceUnits":"esriMeters","uturnAtJunctions":"esriNFSBAllowBacktrack","restrictionAttributeNames":["Avoid Private Roads","Avoid Roads Unsuitable for Pedestrians","Preferred for Pedestrians","Walking"],"useHierarchy":false,"simplificationTolerance":2,"timeAttributeName":"WalkTime","distanceAttributeName":"Kilometers","type":"WALK","id":"caFAgoThrvUpkFBW","name":"Walking Time"}',
  "Walking Distance": '{"attributeParameterValues":[{"parameterName":"Restriction Usage","attributeName":"Avoid Private Roads","value":"AVOID_MEDIUM"},{"parameterName":"Restriction Usage","attributeName":"Walking","value":"PROHIBITED"},{"parameterName":"Restriction Usage","attributeName":"Preferred for Pedestrians","value":"PREFER_LOW"},{"parameterName":"Walking Speed (km/h)","attributeName":"WalkTime","value":5},{"parameterName":"Restriction Usage","attributeName":"Avoid Roads Unsuitable for Pedestrians","value":"AVOID_HIGH"}],"description":"Follows paths and roads that allow pedestrian traffic and finds solutions that optimize travel distance.","impedanceAttributeName":"Kilometers","simplificationToleranceUnits":"esriMeters","uturnAtJunctions":"esriNFSBAllowBacktrack","restrictionAttributeNames":["Avoid Private Roads","Avoid Roads Unsuitable for Pedestrians","Preferred for Pedestrians","Walking"],"useHierarchy":false,"simplificationTolerance":2,"timeAttributeName":"WalkTime","distanceAttributeName":"Kilometers","type":"WALK","id":"yFuMFwIYblqKEefX","name":"Walking Distance"}',
  "Rural Driving": '{"attributeParameterValues":[{"parameterName":"Restriction Usage","attributeName":"Avoid Private Roads","value":"AVOID_MEDIUM"},{"parameterName":"Restriction Usage","attributeName":"Driving an Automobile","value":"PROHIBITED"},{"parameterName":"Restriction Usage","attributeName":"Through Traffic Prohibited","value":"AVOID_HIGH"},{"parameterName":"Restriction Usage","attributeName":"Roads Under Construction Prohibited","value":"PROHIBITED"},{"parameterName":"Restriction Usage","attributeName":"Avoid Gates","value":"AVOID_MEDIUM"},{"parameterName":"Restriction Usage","attributeName":"Avoid Express Lanes","value":"PROHIBITED"},{"parameterName":"Restriction Usage","attributeName":"Avoid Carpool Roads","value":"PROHIBITED"}],"description":"Models the movement of cars and other similar small automobiles, such as pickup trucks, and finds solutions that optimize travel time. Travel obeys one-way roads, avoids illegal turns, and follows other rules that are specific to cars, but does not discourage travel on unpaved roads. Dynamic travel speeds based on traffic are used where it is available when you specify a start time.","impedanceAttributeName":"TravelTime","simplificationToleranceUnits":"esriMeters","uturnAtJunctions":"esriNFSBAtDeadEndsAndIntersections","restrictionAttributeNames":["Avoid Carpool Roads","Avoid Express Lanes","Avoid Gates","Avoid Private Roads","Driving an Automobile","Roads Under Construction Prohibited","Through Traffic Prohibited"],"useHierarchy":true,"simplificationTolerance":10,"timeAttributeName":"TravelTime","distanceAttributeName":"Kilometers","type":"AUTOMOBILE","id":"NmNhNDUwZmE1YTlj","name":"Rural Driving Time"}',
  "Rural Driving Distance" : '{"attributeParameterValues":[{"parameterName":"Restriction Usage","attributeName":"Avoid Private Roads","value":"AVOID_MEDIUM"},{"parameterName":"Restriction Usage","attributeName":"Driving an Automobile","value":"PROHIBITED"},{"parameterName":"Restriction Usage","attributeName":"Through Traffic Prohibited","value":"AVOID_HIGH"},{"parameterName":"Vehicle Maximum Speed (km/h)","attributeName":"TravelTime","value":0},{"parameterName":"Restriction Usage","attributeName":"Roads Under Construction Prohibited","value":"PROHIBITED"},{"parameterName":"Restriction Usage","attributeName":"Avoid Gates","value":"AVOID_MEDIUM"},{"parameterName":"Restriction Usage","attributeName":"Avoid Express Lanes","value":"PROHIBITED"},{"parameterName":"Restriction Usage","attributeName":"Avoid Carpool Roads","value":"PROHIBITED"}],"description":"Models the movement of cars and other similar small automobiles, such as pickup trucks, and finds solutions that optimize travel distance. Travel obeys one-way roads, avoids illegal turns, and follows other rules that are specific to cars, but does not discourage travel on unpaved roads.","impedanceAttributeName":"Kilometers","simplificationToleranceUnits":"esriMeters","uturnAtJunctions":"esriNFSBAtDeadEndsAndIntersections","restrictionAttributeNames":["Avoid Carpool Roads","Avoid Express Lanes","Avoid Gates","Avoid Private Roads","Driving an Automobile","Roads Under Construction Prohibited","Through Traffic Prohibited"],"useHierarchy":true,"simplificationTolerance":10,"timeAttributeName":"TravelTime","distanceAttributeName":"Kilometers","type":"AUTOMOBILE","id":"Yzk3NjI1NTU5NjVj","name":"Rural Driving Distance"}'
}

},{}]},{},[9,10,11]);
