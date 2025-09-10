import fetch from 'node-fetch'

(async () => {
  const base = process.env.BASE_URL || 'http://localhost:3000'
  const secret = process.env.CRON_SHARED_SECRET || ''
  if (!secret) {
    console.error('CRON_SHARED_SECRET is not set in environment')
    process.exit(1)
  }

  try {
    const resp = await fetch(`${base}/api/jobs/daily`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-cron-secret': secret
      },
      body: JSON.stringify({})
    })
    const text = await resp.text()
    console.log('Status:', resp.status)
    console.log(text)
  } catch (e) {
    console.error('Error triggering daily job:', (e as Error).message)
    process.exit(1)
  }
})()

