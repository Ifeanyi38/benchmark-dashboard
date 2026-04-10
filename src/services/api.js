import axios from 'axios'

// All API calls point to the Django benchmark backend.
// The base URL matches the Django dev server port.
const API = axios.create({
  baseURL: 'http://localhost:8000/api/benchmark',
})

// Returns current record counts for both databases.
// Called on dashboard load and after every seed or clear operation.
export const getStatus = () => API.get('/status/')

// Clears all data and indexes from both MySQL and MongoDB.
export const clearDatabases = () => API.post('/clear/')

// Seeds both databases with identical data at the selected size.
// size is one of: '1k', '50k', '500k', '1m', '5m', '10m'
export const seedDatabases = (size) => API.post('/seed/', { size })

// Index management
export const addIndexes    = () => API.post('/indexes/add/')
export const removeIndexes = () => API.post('/indexes/remove/')
export const getIndexStatus = () => API.get('/indexes/status/')

// Returns the list of available benchmark operations for the checkboxes.
export const getOperations = () => API.get('/operations/')

// Runs selected benchmark operations and returns results.
// operations is either 'all' or an array of operation keys.
export const runBenchmark = (operations, runs = 100) =>
  API.post('/run/', { operations, runs })