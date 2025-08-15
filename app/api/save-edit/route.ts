import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  const { previewId, field, value } = await request.json();
  
  // Get current custom_edits
  const { data: preview } = await supabase
    .from('website_previews')
    .select('custom_edits')
    .eq('id', previewId)
    .single();
  
  // Update with new value
  const customEdits = preview?.custom_edits || {};
  customEdits[field] = value;
  
  // Save back to database
  await supabase
    .from('website_previews')
    .update({ 
      custom_edits: customEdits,
      last_edited_at: new Date().toISOString()
    })
    .eq('id', previewId);
  
  return NextResponse.json({ success: true });
}
