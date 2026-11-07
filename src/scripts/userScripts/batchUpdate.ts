/**
 * Convert production years to premiere dates for media items in a Jellyfin library.
 * This script fetches all media items, checks their production years, and if a premiere date is missing, it can be set based on the production year.
 */

import { BaseItemDto } from '@jellyfin/sdk/lib/generated-client';
import { ServerConnections } from 'lib/jellyfin-apiclient';
import type { ScriptContext } from 'types/ScriptContext';
import { ApiClient } from 'jellyfin-apiclient';

async function retriveItems(apiClient: ApiClient, userId: string, parentId: string | null): Promise<BaseItemDto[]> {
    const options = {
        parentId: parentId
    };

    const items = await apiClient.getItems(userId, options);

    if (!items.Items || items.Items.length === 0) {
        return [];
    }

    const validItems: BaseItemDto[] = [];
    for (const item of items.Items) {
        if (!item.Id) {
            continue;
        }

        validItems.push(item);
    }

    return validItems;
}

function convertMapToRecord(map: Map<string, string>): Record<string, string> {
    const record: Record<string, string> = {};
    map.forEach((value, key) => {
        record[key] = value;
    });
    return record;
}

export default {
    name: 'Batch Metadata Update',
    description: 'Update metadata of items in a batch',
    isExample: true,
    execute: async (context: ScriptContext) => {
        try {
            const apiClient = ServerConnections.currentApiClient();
            if (!apiClient) {
                context.fail('Can\'t get api client');
                return;
            }

            const userId = apiClient.getCurrentUserId();

            context.log('I: Fetching root items...');

            let lastSelection: string | null = null;
            const selection = new Map<string, string>();
            while (true) {
                selection.clear();
                const items = await retriveItems(apiClient, userId, lastSelection);
                context.log(`Found ${items.length} valid items`);

                if (items.length == 0) {
                    context.skip('There is no sub-items');
                    return;
                }

                for (const item of items) {
                    context.log(`I: ${item.Name} ${item.Id}(${item.Type})`);

                    selection.set(item.Name || item.Id!, item.Id!);
                }

                const userSelection = await context.select('Select item to enter', convertMapToRecord(selection));
                if (!userSelection) {
                    break;
                }

                lastSelection = userSelection;
            }

            if (!lastSelection) {
                context.skip('User did not select anything');
                return;
            }

            context.log(`User selected item ${lastSelection} for batch update`);

            while (true) {
                const excl = await context.select('Do you want to exclude any items?', convertMapToRecord(selection));
                if (!excl) {
                    break;
                }

                let delKey;
                for (const [key, val] of selection) {
                    if (val == excl) {
                        delKey = key;
                        break;
                    }
                }

                if (!delKey) {
                    context.fail('invalid selection');
                    return;
                }

                selection.delete(delKey);
                context.log(`Excluded ${delKey}`);
            }

            const itemIds = [];
            selection.forEach(val => {
                itemIds.push(val);
            });

            context.log(`I: Final items: ${itemIds.length}`);
            selection.forEach((val, key) => {
                context.log(`I: ${key} ${val}`);
            });

            const operations: Record<string, string> = {
                'Tags': 'tags',
                'People': 'people',
                'Genres': 'genres'
            };
            const operation = await context.select('What operation do you want to do?', operations);

            // TODO: implement update logic
            context.skip('Not implemented yet');
        } catch (error) {
            context.log('E: ' + (error instanceof Error ? error.message : String(error)));
            throw error;
        }
    }
};
