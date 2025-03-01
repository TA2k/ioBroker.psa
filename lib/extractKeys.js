//v3.0
const JSONbig = require("json-bigint");
const alreadyCreatedOBjects = {};
async function extractKeys(adapter, path, element, preferedArrayName, forceIndex, write) {
  try {
    if (element === null || element === undefined) {
      adapter.log.debug("Cannot extract empty: " + path);
      return;
    }
    const objectKeys = Object.keys(element);

    if (!write) {
      write = false;
    }
    if (Array.isArray(element)) {
      extractArray(adapter, element, "", path, write, preferedArrayName, forceIndex);
      return;
    }

    if (typeof element === "string" || typeof element === "number") {
      let name = element;
      if (typeof element === "number") {
        name = element.toString();
      }
      if (!alreadyCreatedOBjects[path]) {
        await adapter
          .setObjectNotExistsAsync(path, {
            type: "state",
            common: {
              name: name,
              role: getRole(element, write),
              type: typeof element,
              write: write,
              read: true,
            },
            native: {},
          })
          .then(() => {
            alreadyCreatedOBjects[path] = true;
          })
          .catch((error) => {
            adapter.log.error(error);
          });
      }

      adapter.setState(path, element, true);
      return;
    }

    objectKeys.forEach(async (key) => {
      if (isJsonString(element[key])) {
        element[key] = JSONbig.parse(element[key]);
      }

      if (Array.isArray(element[key])) {
        extractArray(adapter, element, key, path, write, preferedArrayName, forceIndex);
      } else if (element[key] !== null && typeof element[key] === "object") {
        extractKeys(adapter, path + "." + key, element[key], preferedArrayName, forceIndex, write);
      } else {
        if (!alreadyCreatedOBjects[path + "." + key]) {
          await adapter
            .setObjectNotExistsAsync(path + "." + key, {
              type: "state",
              common: {
                name: key,
                role: getRole(element[key], write),
                type: typeof element[key],
                write: write,
                read: true,
              },
              native: {},
            })
            .then(() => {
              alreadyCreatedOBjects[path + "." + key] = true;
            })
            .catch((error) => {
              adapter.log.error(error);
            });
        }
        adapter.setState(path + "." + key, element[key], true);
      }
    });
  } catch (error) {
    adapter.log.error("Error extract keys: " + path + " " + JSON.stringify(element));
    adapter.log.error(error);
  }
}
function extractArray(adapter, element, key, path, write, preferedArrayName, forceIndex) {
  try {
    if (key) {
      element = element[key];
    }
    element.forEach(async (arrayElement, index) => {
      index = index + 1;
      if (index < 10) {
        index = "0" + index;
      }
      let arrayPath = key + index;

      if (typeof arrayElement[Object.keys(arrayElement)[0]] === "string") {
        arrayPath = arrayElement[Object.keys(arrayElement)[0]];
      }
      Object.keys(arrayElement).forEach((keyName) => {
        if (keyName.endsWith("Id")) {
          if (arrayElement[keyName] && arrayElement[keyName].replace) {
            arrayPath = arrayElement[keyName].replace(/\./g, "");
          } else {
            arrayPath = arrayElement[keyName];
          }
        }
      });
      Object.keys(arrayElement).forEach((keyName) => {
        if (keyName.endsWith("Name")) {
          arrayPath = arrayElement[keyName];
        }
      });

      if (arrayElement.id) {
        if (arrayElement.id.replace) {
          arrayPath = arrayElement.id.replace(/\./g, "");
        } else {
          arrayPath = arrayElement.id;
        }
      }
      if (arrayElement.name) {
        arrayPath = arrayElement.name.replace(/\./g, "");
      }
      if (arrayElement.start_date_time) {
        arrayPath = arrayElement.start_date_time.replace(/\./g, "");
      }
      if (preferedArrayName && arrayElement[preferedArrayName]) {
        arrayPath = arrayElement[preferedArrayName].replace(/\./g, "");
      }

      if (forceIndex) {
        arrayPath = key + index;
      }
      //special case array with 2 string objects
      if (
        Object.keys(arrayElement).length === 2 &&
        typeof Object.keys(arrayElement)[0] === "string" &&
        typeof Object.keys(arrayElement)[1] === "string" &&
        typeof arrayElement[Object.keys(arrayElement)[0]] !== "object" &&
        typeof arrayElement[Object.keys(arrayElement)[1]] !== "object" &&
        arrayElement[Object.keys(arrayElement)[0]] !== "null"
      ) {
        let subKey = arrayElement[Object.keys(arrayElement)[0]];
        const subValue = arrayElement[Object.keys(arrayElement)[1]];
        const subName = Object.keys(arrayElement)[0] + " " + Object.keys(arrayElement)[1];
        if (key) {
          subKey = key + "." + subKey;
        }
        if (!alreadyCreatedOBjects[path + "." + subKey]) {
          await adapter
            .setObjectNotExistsAsync(path + "." + subKey, {
              type: "state",
              common: {
                name: subName,
                role: getRole(subValue, write),
                type: typeof subValue,
                write: write,
                read: true,
              },
              native: {},
            })
            .then(() => {
              alreadyCreatedOBjects[path + "." + subKey] = true;
            });
        }
        adapter.setState(path + "." + subKey, subValue, true);
        return;
      }
      extractKeys(adapter, path + "." + arrayPath, arrayElement, preferedArrayName, forceIndex, write);
    });
  } catch (error) {
    adapter.log.error("Cannot extract array " + path);
    adapter.log.error(error);
  }
}
function isJsonString(str) {
  try {
    JSON.parse(str);
    //eslint-disable-next-line
  } catch (e) {
    return false;
  }
  return true;
}
function getRole(element, write) {
  if (typeof element === "boolean" && !write) {
    return "indicator";
  }
  if (typeof element === "boolean" && write) {
    return "switch";
  }
  if (typeof element === "number" && !write) {
    return "value";
  }
  if (typeof element === "number" && write) {
    return "level";
  }
  if (typeof element === "string") {
    return "text";
  }
  return "state";
}
module.exports = {
  extractKeys,
};
