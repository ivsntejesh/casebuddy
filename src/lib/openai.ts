// lib/openai.ts
export interface OpenAIResponse {
  content: string;
  framework?: string;
  keyInsights?: string[];
  recommendations?: string[];
}

export class OpenAIService {
  private apiKey: string;
  private baseUrl = 'https://api.openai.com/v1/chat/completions';

  constructor() {
    this.apiKey = process.env.NEXT_PUBLIC_OPENAI_API_KEY || '';
    if (!this.apiKey) {
      console.warn('OpenAI API key not found. AI features will be disabled.');
    }
  }

  async generateCaseStudyResponse(
    questionTitle: string,
    questionDescription: string,
    questionType: 'consulting' | 'product',
    difficulty: 'easy' | 'medium' | 'hard'
  ): Promise<OpenAIResponse> {
    if (!this.apiKey) {
      throw new Error('OpenAI API key not configured');
    }

    // Validate API key format
    if (!this.apiKey.startsWith('sk-')) {
      throw new Error('Invalid OpenAI API key format. Key should start with "sk-"');
    }

    const systemPrompt = this.getSystemPrompt(questionType, difficulty);
    const userPrompt = `Case Study: ${questionTitle}\n\n${questionDescription}`;

    console.log('🤖 Making OpenAI API request...');
    console.log('API Key format check:', this.apiKey.startsWith('sk-') ? '✅ Valid format' : '❌ Invalid format');

    try {
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'User-Agent': 'CaseBuddy/1.0',
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo', // Changed from gpt-4 to gpt-3.5-turbo for better availability
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          max_tokens: 1500,
          temperature: 0.7,
        }),
      });

      console.log('📡 OpenAI Response Status:', response.status);
      console.log('📡 OpenAI Response Headers:', Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        const errorData = await response.text();
        console.error('❌ OpenAI API Error Response:', errorData);
        
        if (response.status === 401) {
          throw new Error('Invalid OpenAI API key. Please check your API key.');
        } else if (response.status === 404) {
          throw new Error('OpenAI API endpoint not found. Please check your API configuration.');
        } else if (response.status === 429) {
          throw new Error('OpenAI API rate limit exceeded. Please try again later.');
        } else {
          throw new Error(`OpenAI API error: ${response.status} - ${errorData}`);
        }
      }

      const data = await response.json();
      console.log('✅ OpenAI API Success');
      
      if (!data.choices || !data.choices[0] || !data.choices[0].message) {
        throw new Error('Invalid response format from OpenAI API');
      }

      const aiResponse = data.choices[0].message.content || '';
      return this.parseAIResponse(aiResponse);
    } catch (error) {
      console.error('❌ OpenAI API error:', error);
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Failed to generate AI response');
    }
  }

  private getSystemPrompt(type: 'consulting' | 'product', difficulty: string): string {
    const basePrompt = `You are an expert case study analyst helping MBA students prepare for interviews. `;
    
    let roleSpecific = '';
    if (type === 'consulting') {
      roleSpecific = `You specialize in management consulting case studies similar to those used by McKinsey, BCG, and Bain. `;
    } else {
      roleSpecific = `You specialize in product management case studies similar to those used by top tech companies like Google, Meta, and Amazon. `;
    }

    const approachGuidance = `
Your response should be structured, analytical, and educational. Format your response as follows:

**FRAMEWORK & APPROACH:**
[Provide the structured framework you would use]

**KEY ANALYSIS POINTS:**
[Break down the main analytical components]

**RECOMMENDATIONS:**
[Provide actionable recommendations with reasoning]

**ADDITIONAL INSIGHTS:**
[Include any advanced considerations or alternative perspectives]

Remember to:
- Use structured thinking and clear frameworks
- Show your analytical process step-by-step
- Include quantitative reasoning where applicable
- Consider multiple perspectives and potential risks
- Provide actionable recommendations
- Be educational and explain your reasoning

Difficulty level: ${difficulty} - adjust the depth and complexity accordingly.`;

    return basePrompt + roleSpecific + approachGuidance;
  }

  private parseAIResponse(response: string): OpenAIResponse {
    // Try to extract structured components from the response
    // Using [\s\S] instead of . with 's' flag for ES2017 compatibility
    const frameworkMatch = response.match(/\*\*FRAMEWORK & APPROACH:\*\*([\s\S]*?)(?=\*\*|$)/);
    const keyInsightsMatch = response.match(/\*\*KEY ANALYSIS POINTS:\*\*([\s\S]*?)(?=\*\*|$)/);
    const recommendationsMatch = response.match(/\*\*RECOMMENDATIONS:\*\*([\s\S]*?)(?=\*\*|$)/);

    return {
      content: response,
      framework: frameworkMatch ? frameworkMatch[1].trim() : undefined,
      keyInsights: keyInsightsMatch ? 
        keyInsightsMatch[1].trim().split('\n').filter(line => line.trim()) : 
        undefined,
      recommendations: recommendationsMatch ? 
        recommendationsMatch[1].trim().split('\n').filter(line => line.trim()) : 
        undefined,
    };
  }

  // Method to generate quick insights for existing user answers
  async generateInsightsForAnswer(
    questionTitle: string,
    questionDescription: string,
    userAnswer: string
  ): Promise<string> {
    if (!this.apiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const systemPrompt = `You are an expert case study evaluator. Analyze the user's response to a case study and provide constructive feedback. Focus on:
1. Strengths in their approach
2. Areas for improvement
3. Missing considerations
4. Framework suggestions

Be encouraging but constructive. Keep your feedback concise and actionable.`;

    const userPrompt = `Case Study: ${questionTitle}
    
Problem: ${questionDescription}

Student's Answer: ${userAnswer}

Please provide constructive feedback on this response.`;

    try {
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          max_tokens: 600,
          temperature: 0.7,
        }),
      });

      if (!response.ok) {
        const errorData = await response.text();
        console.error('OpenAI API error:', errorData);
        throw new Error(`OpenAI API error: ${response.status}`);
      }

      const data = await response.json();
      return data.choices[0]?.message?.content || 'Unable to generate feedback';
    } catch (error) {
      console.error('OpenAI API error:', error);
      throw new Error('Failed to generate feedback');
    }
  }

  // Test method to validate API key
  async testAPIKey(): Promise<boolean> {
    if (!this.apiKey) {
      return false;
    }

    try {
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo',
          messages: [{ role: 'user', content: 'Hello' }],
          max_tokens: 10,
        }),
      });

      return response.ok;
    } catch (error) {
      return false;
    }
  }
}

export const openAIService = new OpenAIService();