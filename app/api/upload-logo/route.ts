import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'
import { existsSync } from 'fs'

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('logo') as File
    const previewId = formData.get('previewId') as string
    const businessId = formData.get('businessId') as string

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file provided' },
        { status: 400 }
      )
    }

    if (!previewId || !businessId) {
      return NextResponse.json(
        { success: false, error: 'Missing preview or business ID' },
        { status: 400 }
      )
    }

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json(
        { success: false, error: 'File too large. Maximum size is 5MB.' },
        { status: 400 }
      )
    }

    // Validate file type
    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml']
    if (!validTypes.includes(file.type)) {
      return NextResponse.json(
        { success: false, error: 'Invalid file type. Please upload PNG, JPG, or SVG.' },
        { status: 400 }
      )
    }

    // Generate unique filename
    const timestamp = Date.now()
    const fileExtension = file.name.split('.').pop()
    const fileName = `${businessId}_${timestamp}.${fileExtension}`
    
    // Create uploads directory if it doesn't exist
    const uploadsDir = path.join(process.cwd(), 'public', 'uploads', 'logos')
    if (!existsSync(uploadsDir)) {
      await mkdir(uploadsDir, { recursive: true })
    }

    // Save file to disk
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    const filePath = path.join(uploadsDir, fileName)
    
    await writeFile(filePath, buffer)
    
    // Generate public URL
    const logoUrl = `/uploads/logos/${fileName}`

    // Update database with logo URL
    const { data: updateData, error: updateError } = await supabase
      .from('website_previews')
      .update({ 
        logo_url: logoUrl,
        updated_at: new Date().toISOString()
      })
      .eq('id', previewId)
      .select()
      .single()

    if (updateError) {
      console.error('Database update error:', updateError)
      return NextResponse.json(
        { success: false, error: 'Failed to update database' },
        { status: 500 }
      )
    }

    // Also update the HTML content to include the new logo
    if (updateData && updateData.html_content) {
      // This is a simplified approach - in production you might want to parse and update the HTML more carefully
      let updatedHtml = updateData.html_content
      
      // Try to replace existing logo images
      const logoPatterns = [
        /<img[^>]*class="[^"]*logo[^"]*"[^>]*>/gi,
        /<img[^>]*id="[^"]*logo[^"]*"[^>]*>/gi,
        /<img[^>]*alt="[^"]*logo[^"]*"[^>]*>/gi
      ]
      
      const newLogoTag = `<img src="${logoUrl}" alt="Business Logo" class="logo" style="max-height: 60px; width: auto;">`
      
      let logoReplaced = false
      for (const pattern of logoPatterns) {
        if (pattern.test(updatedHtml)) {
          updatedHtml = updatedHtml.replace(pattern, newLogoTag)
          logoReplaced = true
          break
        }
      }
      
      // If no logo was found to replace, try to add it to the header
      if (!logoReplaced) {
        // Try to find a header or nav element
        const headerPattern = /<(header|nav)[^>]*>/i
        const match = updatedHtml.match(headerPattern)
        if (match) {
          const insertPosition = updatedHtml.indexOf(match[0]) + match[0].length
          updatedHtml = updatedHtml.slice(0, insertPosition) + 
                       `<div class="logo-container">${newLogoTag}</div>` + 
                       updatedHtml.slice(insertPosition)
        }
      }
      
      // Update the HTML content in the database
      await supabase
        .from('website_previews')
        .update({ 
          html_content: updatedHtml,
          updated_at: new Date().toISOString()
        })
        .eq('id', previewId)
    }

    console.log(`Logo uploaded successfully: ${logoUrl}`)

    return NextResponse.json({
      success: true,
      logoUrl: logoUrl,
      message: 'Logo uploaded successfully'
    })

  } catch (error) {
    console.error('Logo upload error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to upload logo' },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Logo upload endpoint',
    method: 'POST',
    acceptedFormats: ['PNG', 'JPG', 'SVG'],
    maxSize: '5MB',
    requiredFields: ['logo', 'previewId', 'businessId']
  })
}
