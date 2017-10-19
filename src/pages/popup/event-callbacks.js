/* Main DOM event-handlers */
import {
  switchActiveTab,
  navigateResults,
  injectTabsInList,
  deleteTab,
} from './dom-utils';
import {
  deleteButton,
  searchInput,
  tabList,
} from './constants';
import filterResults from './search';
import { deletedTabsCache } from './caches';

const reduceKeysToObj = obj => (acc, key) => Object.assign({}, acc, {
  [key]: obj[key],
});
const filterEnableKey = key => key !== 'enableFuzzySearch';
export function configureSearch({ getState, loadedTabs }) {
  const { fuzzy } = getState();
  const { enableFuzzySearch } = fuzzy;
  const fuzzySettings = Object.keys(fuzzy)
    .filter(filterEnableKey)
    .reduce(reduceKeysToObj(fuzzy), {});
  const actualSearchSettings = enableFuzzySearch
    ? fuzzySettings
    : Object.assign({}, fuzzySettings, { threshold: 0 });
  return function updateSearchResults(event) {
    const isSearchEmpty = searchInput.value.length === 0;
    // If input is empty hide the button
    if (isSearchEmpty) {
      deleteButton.classList.add('hidden');
    } else {
      deleteButton.classList.remove('hidden');
    }
    const query = event.target.value.trim().toLowerCase();
    const getSearchResults = isSearchEmpty
      ? x => x
      : filterResults(query, actualSearchSettings);
    return Promise.resolve(
      loadedTabs.filter(({ id }) => !deletedTabsCache().includes(id)),
    )
      .then(getSearchResults)
      .then(injectTabsInList);
  };
}

export function clearInput(event) {
  event.target.value = '';
  tabList.childNodes[0].focus();
}

export function handleKeyDown(event) {
  switch (event.key) {
    case 'Control':
      break;
    case 'Delete':
    case 'Backspace':
      if (event.ctrlKey && document.activeElement !== searchInput) {
        const tabId = parseInt(document.activeElement.dataset.id, 10);
        deleteTab(tabId);
      }
      break;
    case 'Tab':
    case 'ArrowDown':
    case 'ArrowUp':
      event.preventDefault();
    case 'ArrowRight':
    case 'ArrowLeft':
      navigateResults(event.key);
      break;
    case 'Enter':
      event.preventDefault();

      // If we're pressing enter from the searchbar
      if (document.activeElement !== searchInput
        && 'id' in tabList.childNodes[0].dataset) {
        switchActiveTab(tabList.childNodes[0].dataset.id);
      } else {
        switchActiveTab(document.activeElement.dataset.id);
      }
      break;
    case 'Escape':
      // This only works in chrome, in firefox it always closes the window
      if (searchInput.value.length === 0) {
        window.close();
      } else {
        clearInput(searchInput);
      }
      break;
    default:
      searchInput.focus();
      break;
  }
}

export function handleTabClick(event) {
  const tabId = parseInt(event.currentTarget.dataset.id, 10);
  if (event.ctrlKey) {
    deleteTab(tabId, true);
  } else {
    switchActiveTab(tabId);
  }
}
