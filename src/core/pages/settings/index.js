import { createUIStore } from 'redux-webext';
import reducerMap from './inputs-to-reducer';
import * as actions from './actions';
import addInputBindings from './input-bindings';
import { initKeybindingTable } from './dom';

// Object containing input ids and their corresponding nodes
const inputs = [...document.querySelectorAll('input')]
  .filter(({ id }) => Object.keys(reducerMap).includes(id)) // Filter out all inputs who arent in charge of a setting
  .reduce((acc, node) => Object.assign({}, acc, { [node.id]: node }), {});
// Given the setting object and the location we want to search, return the
// current setting value
// e.g. 'fuzzySearch.enableFuzzySearch' -> settings.fuzzySearch.enableFuzzySearch
function findSetting(settings, location) {
  const locationSplit = location.split('.');
  const hasDepth = locationSplit.length > 1;
  if (hasDepth) {
    const walkObject = (acc, key) => acc[key];
    return locationSplit.reduce(walkObject, settings);
  }
  return settings[location];
}

function getStateSettings(settings) {
  return function fillStateSettings(node) {
    const { id, type } = node;
    const stateSettingValue = findSetting(settings, reducerMap[id]);
    switch (type) {
      case 'checkbox':
        if (typeof stateSettingValue === 'boolean') {
          node.checked = stateSettingValue;
        } else if (Array.isArray(stateSettingValue)) {
          // If here this is the showUrls options, the state only stores an
          // an array of keys we're allowed to search in. The only thing
          // we can change is whether the 'url' value is present in the array
          node.checked = stateSettingValue.includes('url');
        }
        break;
      case 'number':
        node.value = stateSettingValue;
        break;
      case 'range':
        node.value = stateSettingValue * 10;
        break;
      default: break;
    }
    node.dispatchEvent(new Event('change'));
  };
}


// Decides which action to dispatch based on the input that changed
function configureEventListeners(dispatch) {
  return function attachEventListeners(node) {
    node.addEventListener('change', (event) => {
      // Figure out which action to dispatch based on the node's props
      const {
        id,
        type,
        value,
        checked,
        validity,
      } = event.currentTarget;
      const settingsLocation = reducerMap[id].split('.');
      const settingKey = settingsLocation[settingsLocation.length - 1];
      switch (type) {
        case 'range': {
          dispatch(actions.updateFuzzyThresholdRange(parseInt(value, 10)));
          break;
        }
        case 'checkbox': {
          if (settingKey === 'showBookmarks' || settingKey === 'showHistory') {
            const permission = settingKey.slice('show'.length).toLowerCase();
            browser.permissions.request({ permissions: [permission] })
              .then((granted) => {
                // If user declines reset the checkbox to unchecked
                if (granted) {
                  dispatch(actions.updateCheckbox(settingKey, checked));
                } else {
                  document.querySelector(`#show${permission.charAt(0).toUpperCase() + permission.slice(1)}`).checked = false;
                }
              });
          } else if (settingsLocation[0] === 'fuzzy' && settingKey !== 'keys') {
            dispatch(actions.updateFuzzyCheckbox(settingKey));
          } else if (settingKey === 'keys') {
            dispatch(actions.updateFuzzySearchKeys(checked));
          } else {
            dispatch(actions.updateCheckbox(settingKey, checked));
          }
          break;
        }
        case 'number': {
          const {
            rangeUnderflow,
            rangeOverflow,
          } = validity;
          if (!rangeUnderflow && !rangeOverflow) {
            dispatch(actions.updateNumber(settingKey, value));
          }
          break;
        }
        default: break;
      }
    });
  };
}

addInputBindings();

createUIStore().then((store) => {
  const { dispatch, getState } = store;
  const settings = getState();
  const fillStateSettings = getStateSettings(settings);
  const attachEventListeners = configureEventListeners(dispatch);
  Object.values(inputs).forEach(fillStateSettings);
  Object.values(inputs).forEach(attachEventListeners);
  initKeybindingTable(store);
  // Fill in current keyboard setting in table
  document.getElementById('reset-defaults').addEventListener('click', () => {
    dispatch(actions.resetSettings());
    location.reload(true);
  });
  return store;
}).catch((e) => {
  throw e;
});
