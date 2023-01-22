const cloneDeep = require('lodash.clonedeep');

function groupSwfObjects(swfObjectGroups) {
	// Merging swf objects from several input swf files
	// Duplicated classes will be discared with respect to the priorities

	var idOffset = 0;
	function updateId(key, val) {
		if (key === 'id') {
			return val + idOffset;
		}
		if (val && typeof val === 'object') {
			Object.entries(val).forEach(([key2, val2]) => {
				val[key2] = updateId(key2, val2);
				if (val[key2] === null || val[key2] === undefined) {
					delete val[key2]; // clean Object
				}
			});
		}
		return val;
	}

	var swfObjects  = [];
	var nGroups     = swfObjectGroups.length;
	for (var g = 0; g < nGroups; g += 1) {
		idOffset = swfObjects.length;

		// Making a deep copy of swf objects with updated IDs
		var updatedSwfObjects = updateId('', cloneDeep(swfObjectGroups[g]));

		var s, swfObject;
		var nObjects = updatedSwfObjects.length;
		for (s = 0; s < nObjects; s += 1) {
			swfObject = updatedSwfObjects[s];
			if (!swfObject) {
				console.warn('[helper.groupSwfObjects] Had to substitute undefined swf object (id ' + s + ') by empty object');
				swfObjects.push({ id: s });
				continue;
			}

			swfObjects.push(swfObject);
		}


		// Updating IDs of the symbolClasses objects within the newly added swf objects
		var nValidObjects = swfObjects.length;
		for (s = idOffset; s < nValidObjects; s += 1) {
			swfObject = swfObjects[s];

			var symbolClasses = swfObject.symbolClasses;
			if (!symbolClasses) {
				continue;
			}

			var newSymbolClasses = {};
			for (var className in symbolClasses) {
				newSymbolClasses[className] = symbolClasses[className] + idOffset;
			}
			swfObject.symbolClasses = newSymbolClasses;
		}
	}

	return swfObjects;
}
module.exports = groupSwfObjects;
