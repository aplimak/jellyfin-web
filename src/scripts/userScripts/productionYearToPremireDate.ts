/**
 * Convert production years to premiere dates for media items in a Jellyfin library.
 * This script fetches all media items, checks their production years, and if a premiere date is missing, it can be set based on the production year.
 */

import { BaseItemDto } from '@jellyfin/sdk/lib/generated-client';
import { ServerConnections } from 'lib/jellyfin-apiclient';
import type { ScriptContext } from 'types/ScriptContext';

export default {
    name: 'Convert Production Year to Premiere Date',
    description: 'Convert production years to premiere dates for media items without premiere dates',
    execute: async (context: ScriptContext) => {
        try {
            const apiClient = ServerConnections.currentApiClient();
            if (!apiClient) {
                context.fail('Can\'t get api client');
                return;
            }

            const userId = apiClient.getCurrentUserId();

            context.log('I: Fetching all media items...');

            const items = await apiClient.getItems(userId, {
                recursive: true,
                includeItemTypes: ['Movie', 'Series', 'Episode', 'MusicAlbum', 'Audio', 'Book'],
                sortBy: ['ProductionYear'],
                sortOrder: ['Descending']
            });

            if (!items.Items || items.Items.length === 0) {
                context.fail('No media items found in your library.');
                return;
            }

            // Extract items from boxsets
            for (const item of items.Items) {
                if (item.Type === 'BoxSet' && item.Id) {
                    // Fetch child items of the boxset
                    const boxSetItems = await apiClient.getItems(userId, {
                        parentId: item.Id,
                        recursive: true,
                        includeItemTypes: ['Movie', 'Series', 'Episode', 'MusicAlbum', 'Audio', 'Book']
                    });
                    if (boxSetItems.Items) {
                        items.Items.push(...boxSetItems.Items);
                    }
                }
            }

            // Remove all boxsets from the main list
            items.Items = items.Items.filter(item => item.Type !== 'BoxSet');

            // List of items with year and without prod date
            const eligibleItems: BaseItemDto[] = [];

            items.Items.forEach((item) => {
                const year = item.ProductionYear;
                if (!year) {
                    context.log(`W: Item ${item.Name} have no year`);
                    return;
                }
                if (item.PremiereDate) {
                    return;
                }

                // Validate year is in format YYYYMMDD
                const yearStr = year.toString();
                if (!/^\d{8}$/.test(yearStr)) {
                    context.log(`W: Item "${item.Name}" has an invalid production year: ${year}`);
                    return;
                }

                // Split year into components                const yearPart = yearStr.substring(0, 4);
                const yearPart = parseInt(yearStr.substring(0, 4), 10);
                const monthPart = parseInt(yearStr.substring(4, 6), 10);
                const dayPart = parseInt(yearStr.substring(6, 8), 10);

                if (isNaN(yearPart) || isNaN(monthPart) || isNaN(dayPart)) {
                    context.log(`W: Item "${item.Name}" has an invalid production year: ${year}`);
                    return;
                }

                // Validate month and day are within valid ranges
                if (monthPart < 1 || monthPart > 12) {
                    context.log(`W: Item "${item.Name}" has an invalid month in production year: ${monthPart}`);
                    return;
                }

                if (dayPart < 1 || dayPart > 31) {
                    context.log(`W: Item "${item.Name}" has an invalid day in production year: ${dayPart}`);
                    return;
                }

                eligibleItems.push(item);
            });

            context.log(`All items: ${items.Items.length}`);
            context.log(`Eligible items: ${eligibleItems.length}`);

            if (eligibleItems.length === 0) {
                context.skip('Nothing to do');
                return;
            }

            // Use context.confirm for user confirmation
            const shouldContinue = await context.confirm(
                `This will update premiere dates for ${eligibleItems.length} items based on their production year. Continue?`
            );

            if (!shouldContinue) {
                context.skip('User cancelled the operation');
                return;
            }

            try {
                for (const item of eligibleItems) {
                    context.log(`I: Processing: ${item.Name}`);
                    let fullItem;

                    try {
                        fullItem = await apiClient.getItem(
                            userId,
                            item.Id!
                        );
                    } catch {
                        context.log('W: Can\'t get the full item');
                        continue;
                    }

                    if (fullItem.PremiereDate) {
                        context.log('W: Item already has premire date');
                        continue;
                    }

                    // Convert production year to premiere date
                    const yearStr = item.ProductionYear!.toString();
                    const yearPart = parseInt(yearStr.substring(0, 4), 10);
                    const monthPart = parseInt(yearStr.substring(4, 6), 10);
                    const dayPart = parseInt(yearStr.substring(6, 8), 10);

                    const newPremiereDate = new Date(Date.UTC(yearPart, monthPart - 1, dayPart, 0, 0, 0, 0)).toISOString();

                    fullItem.PremiereDate = newPremiereDate;
                    fullItem.Trickplay = undefined;

                    try {
                        await apiClient.updateItem(fullItem);
                    } catch {
                        context.log('W: Can\'t update item');
                        continue;
                    }

                    context.log(`S: Updated item with premiere date ${newPremiereDate}`);
                }
            } catch (error) {
                context.log('E: Error updating items: ' + (error instanceof Error ? error.message : String(error)));
                throw error;
            }
        } catch (error) {
            context.log('E: ' + (error instanceof Error ? error.message : String(error)));
            throw error;
        }
    }
};
