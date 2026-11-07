import { playbackManager } from './playback/playbackmanager';

const SUPPORTED_ITEMS = [
    'BoxSet',
    'Playlist'
];

const STORAGE_KEY = 'aeliux_hidePlayedItems';

export function containerSupported(item) {
    return !!(item && item.Type && SUPPORTED_ITEMS.includes(item.Type));
}

export function isEnabled(item) {
    if (!containerSupported(item)) {
        return false;
    }

    const configValue = localStorage.getItem(STORAGE_KEY);

    if (configValue) {
        const lowered = configValue.toLowerCase();
        if (lowered == 'true') {
            return true;
        }
    }

    return false;
}

export function setEnabled(value) {
    localStorage.setItem(STORAGE_KEY, value.toString());
}

export function filterItems(items) {
    const filteredItems = [];
    for (const item of items) {
        if (item.UserData && item.UserData.Played) {
            continue;
        }
        filteredItems.push(item);
    }

    return filteredItems;
}

export function doPlay(options) {
    const doFilter = isEnabled(options.items[0]);
    playbackManager.translateItemsForPlayback(options.items, options).then(items => {
        if (doFilter) {
            const filteredItems = filterItems(items);
            if (filteredItems && filteredItems.length > 0) {
                options.items = filteredItems;
            }
        } else {
            options.items = items;
        }

        if (!options.shuffle && options.items[0].UserData && options.items[0].UserData.PlaybackPositionTicks) {
            options.startPositionTicks = options.items[0].UserData.PlaybackPositionTicks;
        }

        playbackManager.play(options);
    });
}

const exp = {
    containerSupported,
    isEnabled,
    setEnabled,
    filterItems,
    doPlay
};

export default exp;
