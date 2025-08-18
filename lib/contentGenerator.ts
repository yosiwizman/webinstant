import Together from 'together-ai';
import Replicate from 'replicate';

// Initialize AI clients
const together = new Together({
  apiKey: process.env.TOGETHER_API_KEY || '',
});

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN || '',
});

// Dynamic imports for optional dependencies
let Anthropic: any = null;
let getJson: any = null;
let tinify: any = null;

async function initializeOptionalDependencies() {
  try {
    const anthropicModule = await import('@anthropic-ai/sdk');
    Anthropic = anthropicModule.default;
    console.log('✓ Anthropic SDK loaded');
  } catch (e) {
    console.log('✗ Anthropic SDK not available');
  }

  try {
    const serpModule = await import('serpapi');
    getJson = serpModule.getJson;
    console.log('✓ SerpAPI loaded');
  } catch (e) {
    console.log('✗ SerpAPI not available');
  }

  try {
    const tinifyModule = await import('tinify');
    tinify = tinifyModule.default;
    if (process.env.TINYPNG_API_KEY) {
      tinify.key = process.env.TINYPNG_API_KEY;
      console.log('✓ TinyPNG configured');
    }
  } catch (e) {
    console.log('✗ TinyPNG not available');
  }
}

// Initialize on module load
initializeOptionalDependencies();

export interface GeneratedContent {
