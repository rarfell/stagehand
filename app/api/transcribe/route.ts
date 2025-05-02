import { NextRequest } from "next/server";
import { experimental_transcribe as transcribe } from 'ai';
import { openai } from '@ai-sdk/openai';

export async function POST(req: NextRequest) {
  try {
    const { audioData } = await req.json();
    
    if (!audioData) {
      return new Response(JSON.stringify({ error: 'No audio data provided' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const transcript = await transcribe({
      model: openai.transcription('whisper-1'),
      audio: new Uint8Array(audioData),
    });

    return new Response(JSON.stringify({ text: transcript.text }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Transcription error:', error);
    return new Response(JSON.stringify({ error: 'Failed to transcribe audio' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
} 