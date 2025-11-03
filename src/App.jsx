import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button.jsx'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.jsx'
import { Input } from '@/components/ui/input.jsx'
import { Label } from '@/components/ui/label.jsx'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert.jsx'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import { Activity, TrendingUp, TrendingDown, Minus, AlertCircle, RefreshCw, Settings } from 'lucide-react'
import './App.css'

function App() {
  const [nightscoutUrl, setNightscoutUrl] = useState('')
  const [apiSecret, setApiSecret] = useState('')
  const [isConfigured, setIsConfigured] = useState(false)
  const [glucoseData, setGlucoseData] = useState(null)
  const [historicalData, setHistoricalData] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [timeRange, setTimeRange] = useState(24) // hours

  // Load configuration from localStorage
  useEffect(() => {
    const savedUrl = localStorage.getItem('nightscoutUrl')
    const savedSecret = localStorage.getItem('apiSecret')
    if (savedUrl) {
      setNightscoutUrl(savedUrl)
      setIsConfigured(true)
      if (savedSecret) setApiSecret(savedSecret)
    }
  }, [])

  // Fetch glucose data
  const fetchGlucoseData = async () => {
    if (!nightscoutUrl) return

    setLoading(true)
    setError(null)

    try {
      // Fetch current glucose reading
      const headers = {}
      if (apiSecret) {
        headers['API-SECRET'] = apiSecret
      }

      const currentResponse = await fetch(`${nightscoutUrl}/api/v1/entries/current.json`, { headers })
      
      if (!currentResponse.ok) {
        throw new Error(`Failed to fetch data: ${currentResponse.status} ${currentResponse.statusText}`)
      }

      const currentData = await currentResponse.json()
      setGlucoseData(currentData)

      // Fetch historical data
      const count = Math.ceil((timeRange * 60) / 5) // Assuming readings every 5 minutes
      const historicalResponse = await fetch(`${nightscoutUrl}/api/v1/entries.json?count=${count}`, { headers })
      
      if (!historicalResponse.ok) {
        throw new Error(`Failed to fetch historical data: ${historicalResponse.status}`)
      }

      const historical = await historicalResponse.json()
      
      // Process historical data for the chart
      const chartData = historical
        .map(entry => ({
          time: new Date(entry.date).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
          glucose: entry.sgv,
          timestamp: entry.date
        }))
        .reverse()

      setHistoricalData(chartData)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // Auto-refresh every 5 minutes
  useEffect(() => {
    if (isConfigured) {
      fetchGlucoseData()
      const interval = setInterval(fetchGlucoseData, 5 * 60 * 1000)
      return () => clearInterval(interval)
    }
  }, [isConfigured, nightscoutUrl, apiSecret, timeRange])

  const handleSaveConfig = () => {
    if (nightscoutUrl) {
      localStorage.setItem('nightscoutUrl', nightscoutUrl)
      if (apiSecret) localStorage.setItem('apiSecret', apiSecret)
      setIsConfigured(true)
    }
  }

  const handleResetConfig = () => {
    localStorage.removeItem('nightscoutUrl')
    localStorage.removeItem('apiSecret')
    setNightscoutUrl('')
    setApiSecret('')
    setIsConfigured(false)
    setGlucoseData(null)
    setHistoricalData([])
  }

  const getTrendIcon = (direction) => {
    if (!direction) return <Minus className="h-8 w-8" />
    
    const upperDir = direction.toUpperCase()
    if (upperDir.includes('UP') || upperDir === 'DOUBLEUP') {
      return <TrendingUp className="h-8 w-8 text-orange-500" />
    } else if (upperDir.includes('DOWN') || upperDir === 'DOUBLEDOWN') {
      return <TrendingDown className="h-8 w-8 text-blue-500" />
    }
    return <Minus className="h-8 w-8 text-gray-500" />
  }

  const getGlucoseColor = (glucose) => {
    if (!glucose) return 'text-gray-500'
    if (glucose < 70) return 'text-red-500'
    if (glucose > 180) return 'text-orange-500'
    return 'text-green-500'
  }

  const getTimeSinceReading = (timestamp) => {
    if (!timestamp) return 'Unknown'
    const now = new Date()
    const readingTime = new Date(timestamp)
    const diffMinutes = Math.floor((now - readingTime) / (1000 * 60))
    
    if (diffMinutes < 1) return 'Just now'
    if (diffMinutes === 1) return '1 minute ago'
    if (diffMinutes < 60) return `${diffMinutes} minutes ago`
    
    const diffHours = Math.floor(diffMinutes / 60)
    if (diffHours === 1) return '1 hour ago'
    return `${diffHours} hours ago`
  }

  // Configuration screen
  if (!isConfigured) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-6 w-6" />
              Glucose Tracker Setup
            </CardTitle>
            <CardDescription>
              Connect to your Nightscout instance to track your MiniMed CGM glucose levels
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="nightscoutUrl">Nightscout URL</Label>
              <Input
                id="nightscoutUrl"
                type="url"
                placeholder="https://your-nightscout.herokuapp.com"
                value={nightscoutUrl}
                onChange={(e) => setNightscoutUrl(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="apiSecret">API Secret (Optional)</Label>
              <Input
                id="apiSecret"
                type="password"
                placeholder="Your API secret"
                value={apiSecret}
                onChange={(e) => setApiSecret(e.target.value)}
              />
            </div>
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Note</AlertTitle>
              <AlertDescription>
                This app requires a configured Nightscout instance that receives data from your MiniMed CGM via CareLink Connect.
              </AlertDescription>
            </Alert>
            <Button onClick={handleSaveConfig} className="w-full" disabled={!nightscoutUrl}>
              Connect to Nightscout
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Main dashboard
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Activity className="h-8 w-8" />
            Glucose Tracker
          </h1>
          <div className="flex gap-2">
            <Button variant="outline" size="icon" onClick={fetchGlucoseData} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
            <Button variant="outline" size="icon" onClick={handleResetConfig}>
              <Settings className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Current Glucose Card */}
        <Card className="border-2">
          <CardHeader>
            <CardTitle>Current Glucose Level</CardTitle>
            <CardDescription>
              Last updated: {glucoseData ? getTimeSinceReading(glucoseData.date) : 'Never'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {glucoseData ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <span className={`text-6xl font-bold ${getGlucoseColor(glucoseData.sgv)}`}>
                    {glucoseData.sgv}
                  </span>
                  <span className="text-2xl text-muted-foreground">mg/dL</span>
                </div>
                <div className="flex flex-col items-center">
                  {getTrendIcon(glucoseData.direction)}
                  <span className="text-sm text-muted-foreground mt-2">
                    {glucoseData.direction || 'Stable'}
                  </span>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                {loading ? 'Loading glucose data...' : 'No data available'}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Glucose Trend Chart */}
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle>Glucose Trend</CardTitle>
                <CardDescription>Last {timeRange} hours</CardDescription>
              </div>
              <div className="flex gap-2">
                {[3, 6, 12, 24].map((hours) => (
                  <Button
                    key={hours}
                    variant={timeRange === hours ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setTimeRange(hours)}
                  >
                    {hours}h
                  </Button>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {historicalData.length > 0 ? (
              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={historicalData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="time" 
                    tick={{ fontSize: 12 }}
                    interval={Math.floor(historicalData.length / 8)}
                  />
                  <YAxis domain={[40, 250]} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'rgba(255, 255, 255, 0.95)', 
                      border: '1px solid #ccc',
                      borderRadius: '8px'
                    }}
                  />
                  <ReferenceLine y={70} stroke="red" strokeDasharray="3 3" label="Low" />
                  <ReferenceLine y={180} stroke="orange" strokeDasharray="3 3" label="High" />
                  <Line 
                    type="monotone" 
                    dataKey="glucose" 
                    stroke="#3b82f6" 
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[400px] flex items-center justify-center text-muted-foreground">
                {loading ? 'Loading historical data...' : 'No historical data available'}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Info Card */}
        <Card>
          <CardHeader>
            <CardTitle>About This App</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>
              This application connects to your Nightscout instance to display real-time glucose data from your MiniMed CGM.
            </p>
            <p>
              <strong>Requirements:</strong> A configured Nightscout instance that receives data from Medtronic CareLink Connect.
            </p>
            <p>
              <strong>Data Refresh:</strong> The app automatically refreshes every 5 minutes to display the latest glucose readings.
            </p>
            <p className="text-xs pt-2">
              Connected to: <code className="bg-muted px-2 py-1 rounded">{nightscoutUrl}</code>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default App

