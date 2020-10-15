import { UpdateNotifier } from 'update-notifier';
import pkg from '../package.json';


/**
 * Checks for an updated version of this package.
 * 
 * @updateCheckInterval How often to check for updates in milliseconds (default is 1 day)
 */
export function checkForUpdates(updateCheckInterval?: number) {

    // Checks for available update
    const notifier = new UpdateNotifier({ pkg, updateCheckInterval });

    // Notify using the built-in convenience method
    notifier.notify();
}
