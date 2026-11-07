import type { ScriptContext } from 'types/ScriptContext';

export default {
    name: 'Show User Agent',
    description: 'A simple script that just prints the user agent',
    execute: async (context: ScriptContext) => {
        context.log(navigator.userAgent);
    }
};
