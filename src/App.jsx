import { useState, useEffect, useRef } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer
} from 'recharts'
import { toPng } from 'html-to-image'
import {
  getStatus, clearDatabases, seedDatabases,
  addIndexes, removeIndexes, getIndexStatus,
  getOperations, runBenchmark
} from './services/api'

const DATASET_SIZES = ['1k', '50k', '500k', '1m', '5m', '10m']

function App() {
  const [status, setStatus]               = useState(null)
  const [selectedSize, setSelectedSize]   = useState('1k')
  const [indexStatus, setIndexStatus]     = useState(null)
  const [operations, setOperations]       = useState([])
  const [selectedOps, setSelectedOps]     = useState([])
  const [selectAll, setSelectAll]         = useState(true)
  const [results, setResults]             = useState([])
  const [benchmarkRuns, setBenchmarkRuns] = useState(100)
  const [loading, setLoading]             = useState(false)
  const [message, setMessage]             = useState(null)
  const [messageType, setMessageType]     = useState('info')

  const chart1Ref = useRef(null)
  const chart2Ref = useRef(null)

  useEffect(() => {
    fetchStatus()
    fetchOperations()
    fetchIndexStatus()
  }, [])

  const showMessage = (text, type = 'success') => {
    setMessage(text)
    setMessageType(type)
    setTimeout(() => setMessage(null), 5000)
  }

  const fetchStatus = async () => {
    try {
      const res = await getStatus()
      setStatus(res.data)
    } catch (err) {
      showMessage('Failed to fetch database status', 'error')
    }
  }

  const fetchOperations = async () => {
    try {
      const res = await getOperations()
      setOperations(res.data.operations)
      setSelectedOps(res.data.operations.map(op => op.key))
    } catch (err) {
      showMessage('Failed to fetch operations', 'error')
    }
  }

  const fetchIndexStatus = async () => {
    try {
      const res = await getIndexStatus()
      setIndexStatus(res.data)
    } catch (err) {
      console.error('Failed to fetch index status')
    }
  }

  const handleClear = async () => {
    if (!window.confirm('Are you sure you want to clear both databases? This cannot be undone.')) return
    setLoading(true)
    try {
      await clearDatabases()
      showMessage('Both databases cleared successfully')
      await fetchStatus()
      await fetchIndexStatus()
      setResults([])
    } catch (err) {
      showMessage('Failed to clear databases', 'error')
    }
    setLoading(false)
  }

  const handleSeed = async () => {
    setLoading(true)
    showMessage(`Seeding both databases with ${selectedSize} dataset. This may take a while...`, 'info')
    try {
      await seedDatabases(selectedSize)
      showMessage(`Both databases seeded successfully with ${selectedSize} dataset`)
      await fetchStatus()
    } catch (err) {
      showMessage('Failed to seed databases', 'error')
    }
    setLoading(false)
  }

  const handleAddIndexes = async () => {
    setLoading(true)
    try {
      await addIndexes()
      showMessage('Indexes added to both databases successfully')
      await fetchIndexStatus()
    } catch (err) {
      showMessage('Failed to add indexes', 'error')
    }
    setLoading(false)
  }

  const handleRemoveIndexes = async () => {
    setLoading(true)
    try {
      await removeIndexes()
      showMessage('Indexes removed from both databases successfully')
      await fetchIndexStatus()
    } catch (err) {
      showMessage('Failed to remove indexes', 'error')
    }
    setLoading(false)
  }

  const handleToggleOp = (key) => {
    setSelectedOps(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    )
  }

  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedOps([])
    } else {
      setSelectedOps(operations.map(op => op.key))
    }
    setSelectAll(!selectAll)
  }

  const handleRunBenchmark = async () => {
    if (selectedOps.length === 0) {
      showMessage('Please select at least one operation', 'error')
      return
    }
    setLoading(true)
    showMessage('Running benchmark. Please wait...', 'info')
    try {
      const ops = selectAll ? 'all' : selectedOps
      const res = await runBenchmark(ops, benchmarkRuns)
      setResults(res.data.results)
      showMessage('Benchmark completed successfully')
    } catch (err) {
      showMessage('Failed to run benchmark', 'error')
    }
    setLoading(false)
  }

  const handleExportCSV = () => {
    if (results.length === 0) return
    const headers = [
      'Operation', 'Category',
      'MySQL Avg', 'MySQL Min', 'MySQL Max', 'MySQL StDev',
      'MongoDB Avg', 'MongoDB Min', 'MongoDB Max', 'MongoDB StDev',
      'Faster'
    ]
    const rows = results.map(r => [
      r.operation, r.category,
      r.mysql.avg, r.mysql.min, r.mysql.max, r.mysql.stdev,
      r.mongodb.avg, r.mongodb.min, r.mongodb.max, r.mongodb.stdev,
      r.faster
    ])
    const csv  = [headers, ...rows].map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `benchmark_results_${selectedSize}_${Date.now()}.csv`
    a.click()
  }

  const handleDownloadChart = async (ref, filename) => {
    if (!ref.current) return
    try {
      const dataUrl = await toPng(ref.current, { quality: 1.0, pixelRatio: 2 })
      const a       = document.createElement('a')
      a.href        = dataUrl
      a.download    = `${filename}_${selectedSize}_${Date.now()}.png`
      a.click()
    } catch (err) {
      showMessage('Failed to download chart', 'error')
    }
  }

  const grouped = operations.reduce((acc, op) => {
    if (!acc[op.category]) acc[op.category] = []
    acc[op.category].push(op)
    return acc
  }, {})

  const chartData = results.map(r => ({
    name:            r.operation,
    MySQL:           r.mysql.avg,
    MongoDB:         r.mongodb.avg,
    'MySQL StDev':   r.mysql.stdev,
    'MongoDB StDev': r.mongodb.stdev,
  }))

  const categoryColors = {
    READ:   '#3b82f6',
    WRITE:  '#10b981',
    UPDATE: '#f59e0b',
    DELETE: '#ef4444'
  }

  return (
    <div style={{ fontFamily: 'Arial, sans-serif', maxWidth: '1400px', margin: '0 auto', padding: '24px', background: '#f8f9fa', minHeight: '100vh' }}>

      {/* Header */}
      <div style={{ background: '#0a1628', color: 'white', padding: '24px 32px', borderRadius: '12px', marginBottom: '24px' }}>
        <h1 style={{ margin: 0, fontSize: '28px', fontWeight: '600' }}>Database Benchmark Dashboard</h1>
        <p style={{ margin: '8px 0 0', color: '#9ba8bc', fontSize: '15px' }}>
          Comparing MySQL vs MongoDB performance — airline booking operations
        </p>
      </div>

      {/* Notification */}
      {message && (
        <div style={{
          padding: '12px 20px', borderRadius: '8px', marginBottom: '20px',
          background:  messageType === 'error' ? '#fee2e2' : messageType === 'info' ? '#dbeafe' : '#dcfce7',
          color:       messageType === 'error' ? '#991b1b' : messageType === 'info' ? '#1e40af' : '#166534',
          border:      `1px solid ${messageType === 'error' ? '#fca5a5' : messageType === 'info' ? '#93c5fd' : '#86efac'}`,
          fontSize: '14px'
        }}>
          {message}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: '24px' }}>

        {/* Left Panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

          {/* Database Status */}
          <div style={{ background: 'white', borderRadius: '12px', padding: '20px', border: '1px solid #e5e7eb' }}>
            <h2 style={{ margin: '0 0 16px', fontSize: '16px', color: '#0a1628' }}>Database Status</h2>
            {status ? (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', padding: '6px 8px', color: '#6b7280', fontWeight: '500' }}>Table</th>
                    <th style={{ textAlign: 'right', padding: '6px 8px', color: '#3b82f6', fontWeight: '500' }}>MySQL</th>
                    <th style={{ textAlign: 'right', padding: '6px 8px', color: '#10b981', fontWeight: '500' }}>MongoDB</th>
                  </tr>
                </thead>
                <tbody>
                  {['airports', 'aircraft', 'flights', 'passengers', 'bookings'].map(key => (
                    <tr key={key} style={{ borderTop: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '6px 8px', textTransform: 'capitalize', color: '#374151' }}>{key}</td>
                      <td style={{ padding: '6px 8px', textAlign: 'right', color: '#3b82f6', fontWeight: '500' }}>
                        {(status.mysql[key] || 0).toLocaleString()}
                      </td>
                      <td style={{ padding: '6px 8px', textAlign: 'right', color: '#10b981', fontWeight: '500' }}>
                        {(status.mongodb[key] || 0).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p style={{ color: '#9ca3af', fontSize: '13px' }}>Loading...</p>
            )}

            <div style={{
              marginTop: '12px', padding: '8px 12px', borderRadius: '6px',
              background: indexStatus?.indexed ? '#dcfce7' : '#f3f4f6',
              fontSize: '12px',
              color: indexStatus?.indexed ? '#166534' : '#6b7280'
            }}>
              Indexes: {indexStatus?.indexed
                ? `Active (MySQL: ${indexStatus.mysql_count} | MongoDB: ${indexStatus.mongo_count})`
                : 'Not active'}
            </div>

            <button
              onClick={fetchStatus}
              style={{ marginTop: '12px', width: '100%', padding: '8px', background: '#f3f4f6', border: '1px solid #e5e7eb', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}
            >
              Refresh Status
            </button>
          </div>

          {/* Database Management */}
          <div style={{ background: 'white', borderRadius: '12px', padding: '20px', border: '1px solid #e5e7eb' }}>
            <h2 style={{ margin: '0 0 16px', fontSize: '16px', color: '#0a1628' }}>Database Management</h2>

            <button
              onClick={handleClear}
              disabled={loading}
              style={{ width: '100%', padding: '10px', background: '#fee2e2', color: '#991b1b', border: '1px solid #fca5a5', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: '500', marginBottom: '12px' }}
            >
              Clear Both Databases
            </button>

            <label style={{ fontSize: '13px', color: '#374151', display: 'block', marginBottom: '6px' }}>
              Select dataset size:
            </label>
            <select
              value={selectedSize}
              onChange={(e) => setSelectedSize(e.target.value)}
              style={{ width: '100%', padding: '8px', border: '1px solid #e5e7eb', borderRadius: '6px', fontSize: '14px', marginBottom: '10px' }}
            >
              {DATASET_SIZES.map(size => (
                <option key={size} value={size}>{size} records</option>
              ))}
            </select>

            <button
              onClick={handleSeed}
              disabled={loading}
              style={{ width: '100%', padding: '10px', background: '#0a1628', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: '500' }}
            >
              {loading ? 'Seeding...' : `Seed Databases (${selectedSize})`}
            </button>
          </div>

          {/* Index Management */}
          <div style={{ background: 'white', borderRadius: '12px', padding: '20px', border: '1px solid #e5e7eb' }}>
            <h2 style={{ margin: '0 0 16px', fontSize: '16px', color: '#0a1628' }}>Index Management</h2>
            <button
              onClick={handleAddIndexes}
              disabled={loading}
              style={{ width: '100%', padding: '10px', background: '#dcfce7', color: '#166634', border: '1px solid #86efac', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: '500', marginBottom: '10px' }}
            >
              Add Indexes
            </button>
            <button
              onClick={handleRemoveIndexes}
              disabled={loading}
              style={{ width: '100%', padding: '10px', background: '#fef9c3', color: '#854d0e', border: '1px solid #fde047', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: '500' }}
            >
              Remove Indexes
            </button>
          </div>

          {/* Operation Selection */}
          <div style={{ background: 'white', borderRadius: '12px', padding: '20px', border: '1px solid #e5e7eb' }}>
            <h2 style={{ margin: '0 0 12px', fontSize: '16px', color: '#0a1628' }}>Select Operations</h2>

            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', marginBottom: '12px', cursor: 'pointer', fontWeight: '500' }}>
              <input type="checkbox" checked={selectAll} onChange={handleSelectAll} />
              Select all operations
            </label>

            {Object.entries(grouped).map(([category, ops]) => (
              <div key={category} style={{ marginBottom: '12px' }}>
                <div style={{ fontSize: '11px', fontWeight: '600', color: 'white', background: categoryColors[category], padding: '3px 8px', borderRadius: '4px', display: 'inline-block', marginBottom: '6px' }}>
                  {category}
                </div>
                {ops.map(op => (
                  <label key={op.key} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', padding: '4px 0', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={selectedOps.includes(op.key)}
                      onChange={() => handleToggleOp(op.key)}
                    />
                    {op.label}
                  </label>
                ))}
              </div>
            ))}

            <div style={{ marginTop: '12px', borderTop: '1px solid #f3f4f6', paddingTop: '12px' }}>
              <label style={{ fontSize: '13px', color: '#374151', display: 'block', marginBottom: '6px' }}>
                Runs per operation:
              </label>
              <input
                type="number"
                value={benchmarkRuns}
                onChange={(e) => setBenchmarkRuns(parseInt(e.target.value))}
                min="10"
                max="1000"
                style={{ width: '100%', padding: '8px', border: '1px solid #e5e7eb', borderRadius: '6px', fontSize: '14px' }}
              />
            </div>

            <button
              onClick={handleRunBenchmark}
              disabled={loading || selectedOps.length === 0}
              style={{ width: '100%', marginTop: '12px', padding: '12px', background: loading ? '#9ca3af' : '#2563eb', color: 'white', border: 'none', borderRadius: '8px', cursor: loading ? 'not-allowed' : 'pointer', fontSize: '15px', fontWeight: '600' }}
            >
              {loading ? 'Running...' : 'Run Benchmark'}
            </button>
          </div>

        </div>

        {/* Right Panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

          {results.length === 0 ? (
            <div style={{ background: 'white', borderRadius: '12px', padding: '60px', border: '1px solid #e5e7eb', textAlign: 'center', color: '#9ca3af' }}>
              <p style={{ fontSize: '16px', margin: 0 }}>No benchmark results yet.</p>
              <p style={{ fontSize: '13px', marginTop: '8px' }}>Seed the databases and click Run Benchmark to see results here.</p>
            </div>
          ) : (
            <>
              {/* Results Table */}
              <div style={{ background: 'white', borderRadius: '12px', padding: '20px', border: '1px solid #e5e7eb' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h2 style={{ margin: 0, fontSize: '16px', color: '#0a1628' }}>Benchmark Results</h2>
                  <button
                    onClick={handleExportCSV}
                    style={{ padding: '8px 16px', background: '#0a1628', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}
                  >
                    Export CSV
                  </button>
                </div>

                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                    <thead>
                      <tr style={{ background: '#f8f9fa' }}>
                        <th style={{ padding: '10px 12px', textAlign: 'left',   color: '#374151', fontWeight: '600', borderBottom: '2px solid #e5e7eb' }}>Operation</th>
                        <th style={{ padding: '10px 12px', textAlign: 'center', color: '#374151', fontWeight: '600', borderBottom: '2px solid #e5e7eb' }}>Category</th>
                        <th style={{ padding: '10px 12px', textAlign: 'right',  color: '#3b82f6', fontWeight: '600', borderBottom: '2px solid #e5e7eb' }}>MySQL Avg</th>
                        <th style={{ padding: '10px 12px', textAlign: 'right',  color: '#3b82f6', fontWeight: '600', borderBottom: '2px solid #e5e7eb' }}>MySQL Min</th>
                        <th style={{ padding: '10px 12px', textAlign: 'right',  color: '#3b82f6', fontWeight: '600', borderBottom: '2px solid #e5e7eb' }}>MySQL Max</th>
                        <th style={{ padding: '10px 12px', textAlign: 'right',  color: '#3b82f6', fontWeight: '600', borderBottom: '2px solid #e5e7eb' }}>MySQL StDev</th>
                        <th style={{ padding: '10px 12px', textAlign: 'right',  color: '#10b981', fontWeight: '600', borderBottom: '2px solid #e5e7eb' }}>MongoDB Avg</th>
                        <th style={{ padding: '10px 12px', textAlign: 'right',  color: '#10b981', fontWeight: '600', borderBottom: '2px solid #e5e7eb' }}>MongoDB Min</th>
                        <th style={{ padding: '10px 12px', textAlign: 'right',  color: '#10b981', fontWeight: '600', borderBottom: '2px solid #e5e7eb' }}>MongoDB Max</th>
                        <th style={{ padding: '10px 12px', textAlign: 'right',  color: '#10b981', fontWeight: '600', borderBottom: '2px solid #e5e7eb' }}>MongoDB StDev</th>
                        <th style={{ padding: '10px 12px', textAlign: 'center', color: '#374151', fontWeight: '600', borderBottom: '2px solid #e5e7eb' }}>Faster</th>
                      </tr>
                    </thead>
                    <tbody>
                      {results.map((r, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid #f3f4f6', background: i % 2 === 0 ? 'white' : '#f9fafb' }}>
                          <td style={{ padding: '10px 12px', color: '#111827', fontWeight: '500' }}>{r.operation}</td>
                          <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                            <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '600', color: 'white', background: categoryColors[r.category] }}>
                              {r.category}
                            </span>
                          </td>
                          <td style={{ padding: '10px 12px', textAlign: 'right', color: '#3b82f6' }}>{r.mysql.avg}ms</td>
                          <td style={{ padding: '10px 12px', textAlign: 'right', color: '#3b82f6' }}>{r.mysql.min}ms</td>
                          <td style={{ padding: '10px 12px', textAlign: 'right', color: '#3b82f6' }}>{r.mysql.max}ms</td>
                          <td style={{ padding: '10px 12px', textAlign: 'right', color: '#3b82f6' }}>{r.mysql.stdev}ms</td>
                          <td style={{ padding: '10px 12px', textAlign: 'right', color: '#10b981' }}>{r.mongodb.avg}ms</td>
                          <td style={{ padding: '10px 12px', textAlign: 'right', color: '#10b981' }}>{r.mongodb.min}ms</td>
                          <td style={{ padding: '10px 12px', textAlign: 'right', color: '#10b981' }}>{r.mongodb.max}ms</td>
                          <td style={{ padding: '10px 12px', textAlign: 'right', color: '#10b981' }}>{r.mongodb.stdev}ms</td>
                          <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                            <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '600', color: 'white', background: r.faster === 'MySQL' ? '#3b82f6' : '#10b981' }}>
                              {r.faster}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Chart 1 — Average query time */}
              <div style={{ background: 'white', borderRadius: '12px', padding: '20px', border: '1px solid #e5e7eb' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h2 style={{ margin: 0, fontSize: '16px', color: '#0a1628' }}>Average Query Time (ms)</h2>
                  <button
                    onClick={() => handleDownloadChart(chart1Ref, 'chart_avg')}
                    style={{ padding: '8px 16px', background: '#0a1628', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}
                  >
                    Download Chart
                  </button>
                </div>
                <div ref={chart1Ref} style={{ background: 'white', padding: '16px' }}>
                  <p style={{ margin: '0 0 4px', fontSize: '14px', fontWeight: '600', color: '#0a1628', textAlign: 'center' }}>
                    MySQL vs MongoDB — Average Query Time per Operation (ms)
                  </p>
                  <p style={{ margin: '0 0 16px', fontSize: '12px', color: '#6b7280', textAlign: 'center' }}>
                    Dataset size: {selectedSize} | Runs per operation: {benchmarkRuns}
                  </p>
                  <ResponsiveContainer width="100%" height={320}>
                    <BarChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 80 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" angle={-30} textAnchor="end" tick={{ fontSize: 11 }} interval={0} />
                      <YAxis tick={{ fontSize: 11 }} label={{ value: 'Time (ms)', angle: -90, position: 'insideLeft', offset: 10, style: { fontSize: 11 } }} />
                      <Tooltip formatter={(value) => `${value}ms`} />
                      <Legend verticalAlign="top" height={36} />
                      <Bar dataKey="MySQL"   fill="#3b82f6" />
                      <Bar dataKey="MongoDB" fill="#10b981" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Chart 2 — Standard deviation */}
              <div style={{ background: 'white', borderRadius: '12px', padding: '20px', border: '1px solid #e5e7eb' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h2 style={{ margin: 0, fontSize: '16px', color: '#0a1628' }}>Consistency — Standard Deviation (ms)</h2>
                  <button
                    onClick={() => handleDownloadChart(chart2Ref, 'chart_stdev')}
                    style={{ padding: '8px 16px', background: '#0a1628', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}
                  >
                    Download Chart
                  </button>
                </div>
                <div ref={chart2Ref} style={{ background: 'white', padding: '16px' }}>
                  <p style={{ margin: '0 0 4px', fontSize: '14px', fontWeight: '600', color: '#0a1628', textAlign: 'center' }}>
                    MySQL vs MongoDB — Consistency (Standard Deviation in ms)
                  </p>
                  <p style={{ margin: '0 0 16px', fontSize: '12px', color: '#6b7280', textAlign: 'center' }}>
                    Dataset size: {selectedSize} | Lower value = more consistent | Runs: {benchmarkRuns}
                  </p>
                  <ResponsiveContainer width="100%" height={320}>
                    <BarChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 80 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" angle={-30} textAnchor="end" tick={{ fontSize: 11 }} interval={0} />
                      <YAxis tick={{ fontSize: 11 }} label={{ value: 'StDev (ms)', angle: -90, position: 'insideLeft', offset: 10, style: { fontSize: 11 } }} />
                      <Tooltip formatter={(value) => `${value}ms`} />
                      <Legend verticalAlign="top" height={36} />
                      <Bar dataKey="MySQL StDev"   fill="#3b82f6" name="MySQL StDev" />
                      <Bar dataKey="MongoDB StDev" fill="#10b981" name="MongoDB StDev" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default App