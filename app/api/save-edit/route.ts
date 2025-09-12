import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client safely with fallbacks to avoid build-time failures
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'anon-development-key';

function getSupabase() {
  return createClient(supabaseUrl || 'http://localhost:54321', supabaseKey);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { previewId, field, value } = body;

    console.log('Saving edit:', { previewId, field, value });

    if (!previewId || !field || value === undefined) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const supabase = getSupabase();
    // Get current preview data
    const { data: preview, error: fetchError } = await supabase
      .from('website_previews')
      .select('custom_edits')
      .eq('id', previewId)
      .single();

    if (fetchError) {
      console.error('Error fetching preview:', fetchError);
      return NextResponse.json(
        { success: false, error: 'Preview not found' },
        { status: 404 }
      );
    }

    // Update custom_edits object
    const customEdits = preview?.custom_edits || {};
    customEdits[field] = value;

    // Save back to database
    const { error: updateError } = await supabase
      .from('website_previews')
      .update({ 
        custom_edits: customEdits,
        updated_at: new Date().toISOString()
      })
      .eq('id', previewId);

    if (updateError) {
      console.error('Error updating preview:', updateError);
      return NextResponse.json(
        { success: false, error: 'Failed to save changes' },
        { status: 500 }
      );
    }

    console.log('Successfully saved edit for field:', field);

    return NextResponse.json({ 
      success: true,
      field: field,
      value: value
    });
  } catch (error) {
    console.error('Error in save-edit route:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Edit save endpoint',
    method: 'POST',
    requiredFields: ['previewId', 'field', 'value']
  });
}
