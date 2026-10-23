import PocketBase from 'pocketbase';

const POCKETBASE_API_URL = import.meta.env.DEV
  ? 'http://127.0.0.1:8090'
  : '/hcgi/platform';

const pocketbaseClient = new PocketBase(POCKETBASE_API_URL);

export default pocketbaseClient;

export { pocketbaseClient, POCKETBASE_API_URL };
