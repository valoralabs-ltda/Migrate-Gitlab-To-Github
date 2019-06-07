module.exports = {
    getValue,
    isEmpty,
    getLast,
    contains,
    containsObjectProp,
    sortBy,
    shuffleArray,
    getRandomArrayElement
}

function getValue(index, array) {
    if (typeof array[index] === 'undefined') {
        return null;
    }
    return array[index];
}

function isEmpty(array) {
    if (Array.isArray(array)) {
        return array.length <= 0;
    }
    return true;
}

function getLast(array) {
    if (!isEmpty(array)) {
        return array[array.length - 1];
    }
    return undefined;
}

function contains(value, arrValues) {
    if (Array.isArray(arrValues)) {
        return arrValues.includes(value); //arrValues.indexOf(value) > -1;
    }
    return false;
}

function containsObjectProp(objKey, objValue, arrObjs) {
    if (!arrObjs) {
        return false;
    }
    const objFound = arrObjs.filter(obj => obj[objKey] == objValue);
    return (objFound.length > 0);
}

function getRandomArrayElement(array) {
    return array[Math.floor(Math.random() * array.length)];
}

function shuffleArray(array) {
    return array
        .map(a => [Math.random(), a])
        .sort((a, b) => a[0] - b[0])
        .map(a => a[1]);
}

function sortBy(array, property) {
    return array.sort(dynamicSort(property));
}
function dynamicSort(property) {
    var sortOrder = 1;
    if(property[0] === "-") {
        sortOrder = -1;
        property = property.substr(1);
    }
    return function (a,b) {
        var result = (a[property] < b[property]) ? -1 : (a[property] > b[property]) ? 1 : 0;
        return result * sortOrder;
    }
}
function dynamicSortMultiple() {
    /*
     * save the arguments object as it will be overwritten
     * note that arguments object is an array-like object
     * consisting of the names of the properties to sort by
     */
    var props = arguments;
    return function (obj1, obj2) {
        var i = 0, result = 0, numberOfProperties = props.length;
        /* try getting a different result from 0 (equal)
         * as long as we have extra properties to compare
         */
        while(result === 0 && i < numberOfProperties) {
            result = dynamicSort(props[i])(obj1, obj2);
            i++;
        }
        return result;
    }
}