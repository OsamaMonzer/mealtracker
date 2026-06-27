import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';

export async function POST(request) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return NextResponse.json({ error: 'GEMINI_API_KEY not configured' }, { status: 500 });

    const formData = await request.formData();
    const file = formData.get('image');
    if (!file) return NextResponse.json({ error: 'No image provided' }, { status: 400 });

    const buffer = Buffer.from(await file.arrayBuffer());
    const base64 = buffer.toString('base64');
    const mimeType = file.type || 'image/jpeg';

    const prompt = `You are a nutrition expert. Analyze this meal photo and identify all food items visible.

For each food item, provide:
- name: the common food name (e.g. "white rice", "grilled chicken breast", "broccoli")
- weight_g: estimated weight in grams based on visual portion size
- calories_100g: approximate calories per 100g
- protein_100g: approximate protein per 100g in grams
- carbs_100g: approximate carbs per 100g in grams  
- fat_100g: approximate fat per 100g in grams

Respond ONLY with a valid JSON array. No explanation, no markdown, just the array.
Example: [{"name":"white rice","weight_g":150,"calories_100g":130,"protein_100g":2.7,"carbs_100g":28,"fat_100g":0.3}]

If you cannot identify any food in the image, return an empty array: []`;

    const geminiRes = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: prompt },
            { inline_data: { mime_type: mimeType, data: base64 } }
          ]
        }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 1024,
        }
      })
    });

    if (!geminiRes.ok) {
      const err = await geminiRes.text();
      console.error('Gemini error:', err);
      return NextResponse.json({ error: 'Gemini API error', details: err }, { status: 502 });
    }

    const geminiData = await geminiRes.json();
    const text = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || '';

    // Extract JSON array from response
    const jsonMatch = text.match(/\[\s*[\s\S]*?\]/);
    if (!jsonMatch) return NextResponse.json({ foods: [] });

    let foods;
    try {
      foods = JSON.parse(jsonMatch[0]);
    } catch {
      return NextResponse.json({ foods: [] });
    }

    // Validate and sanitize
    const sanitized = foods
      .filter(f => f.name && f.weight_g)
      .map(f => ({
        name: String(f.name).trim(),
        weight_g: Math.round(Number(f.weight_g) || 100),
        calories_100g: Math.round(Number(f.calories_100g) || 0),
        protein_100g: Math.round((Number(f.protein_100g) || 0) * 10) / 10,
        carbs_100g: Math.round((Number(f.carbs_100g) || 0) * 10) / 10,
        fat_100g: Math.round((Number(f.fat_100g) || 0) * 10) / 10,
      }));

    return NextResponse.json({ foods: sanitized });
  } catch (e) {
    console.error('Meal scan error', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
