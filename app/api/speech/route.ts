import { NextRequest } from "next/server";
import { experimental_generateSpeech as generateSpeech } from 'ai';
import { openai } from '@ai-sdk/openai';

export async function POST(req: NextRequest) {
  try {
    const { text } = await req.json();
    
    if (!text) {
      return new Response(JSON.stringify({ error: 'No text provided' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    console.log('Generating speech for text:', text);
    
    const result = await generateSpeech({
      model: openai.speech('tts-1'),
      text: text,
      voice: 'alloy',
    });

    if (!result.audio) {
      console.error('Speech generation result:', result);
      throw new Error('No audio data received from speech generation');
    }

    console.log('Successfully generated speech data');
    
    const audioData = result.audio.uint8Array;
    
    return new Response(JSON.stringify({ audioData: Array.from(audioData) }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Speech generation error:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to generate speech',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
} 