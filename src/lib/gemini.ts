// lib/gemini.ts
export interface GeminiResponse {
  content: string;
  framework?: string;
  keyInsights?: string[];
  recommendations?: string[];
}

export class GeminiService {
  private apiKey: string;
  private baseUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

  constructor() {
    this.apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY || 
                  process.env.VITE_GEMINI_API_KEY ||
                  '';
    
    if (!this.apiKey) {
      console.warn('Gemini API key not found. AI features will be disabled.');
    }
  }

  async generateCaseStudyResponse(
    questionTitle: string,
    questionDescription: string,
    questionType: 'consulting' | 'product',
    difficulty: 'easy' | 'medium' | 'hard'
  ): Promise<GeminiResponse> {
    if (!this.apiKey) {
      throw new Error('Gemini API key not configured');
    }

    const systemPrompt = this.getSystemPrompt(questionType, difficulty);
    const userPrompt = `Case Study: ${questionTitle}\n\n${questionDescription}`;
    const fullPrompt = `${systemPrompt}\n\n${userPrompt}`;

    console.log('🤖 Making Gemini API request...');

    try {
      const requestBody = {
        contents: [{
          parts: [{
            text: fullPrompt
          }]
        }],
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 4096, // Increased from 4096
          stopSequences: [],
        },
        safetySettings: [
          {
            category: "HARM_CATEGORY_HARASSMENT",
            threshold: "BLOCK_MEDIUM_AND_ABOVE"
          },
          {
            category: "HARM_CATEGORY_HATE_SPEECH",
            threshold: "BLOCK_MEDIUM_AND_ABOVE"
          },
          {
            category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
            threshold: "BLOCK_MEDIUM_AND_ABOVE"
          },
          {
            category: "HARM_CATEGORY_DANGEROUS_CONTENT",
            threshold: "BLOCK_MEDIUM_AND_ABOVE"
          }
        ]
      };

      const response = await fetch(`${this.baseUrl}?key=${this.apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      console.log('📡 Gemini Response Status:', response.status);

      if (!response.ok) {
        const errorData = await response.text();
        console.error('❌ Gemini API Error Response:', errorData);
        
        if (response.status === 400) {
          throw new Error('Invalid request to Gemini API. Please check your request format.');
        } else if (response.status === 403) {
          throw new Error('Invalid Gemini API key or insufficient permissions.');
        } else if (response.status === 429) {
          throw new Error('Gemini API rate limit exceeded. Please try again later.');
        } else if (response.status === 404) {
          throw new Error('Gemini API endpoint not found. Please check the model name.');
        } else {
          throw new Error(`Gemini API error: ${response.status} - ${errorData}`);
        }
      }

      const data = await response.json();
      
      // Validation
      if (!data) {
        console.error('No data received from Gemini API');
        return this.getFallbackResponse(questionTitle, questionDescription, questionType, difficulty);
      }

      if (data.error) {
        console.error('Gemini API returned error:', data.error);
        throw new Error(`Gemini API error: ${data.error.message || 'Unknown error'}`);
      }

      if (!data.candidates || data.candidates.length === 0) {
        console.error('No candidates in response');
        return this.getFallbackResponse(questionTitle, questionDescription, questionType, difficulty);
      }

      const candidate = data.candidates[0];
      
      // Check finish reason
      if (candidate.finishReason === 'MAX_TOKENS') {
        console.warn('⚠️ Response truncated due to MAX_TOKENS');
        // Continue with partial response but log warning
      }
      
      if (candidate.finishReason === 'SAFETY' || candidate.finishReason === 'RECITATION') {
        console.warn('Response blocked:', candidate.finishReason);
        return this.getFallbackResponse(questionTitle, questionDescription, questionType, difficulty);
      }

      const aiResponse = candidate.content?.parts?.[0]?.text;
      
      if (!aiResponse) {
        console.error('No text in response');
        return this.getFallbackResponse(questionTitle, questionDescription, questionType, difficulty);
      }

      // Check if response seems truncated
      const isTruncated = !aiResponse.trim().match(/[.!?]$/);
      if (isTruncated) {
        console.warn('⚠️ Response may be incomplete (no ending punctuation)');
      }

      console.log('✅ Gemini API Success');
      console.log('Response length:', aiResponse.length, 'characters');
      console.log('Finish reason:', candidate.finishReason);
      
      return this.parseAIResponse(aiResponse);

    } catch (error) {
      console.error('❌ Gemini API error:', error);
      
      if (error instanceof Error) {
        throw new Error(`Gemini API Error: ${error.message}`);
      }
      throw new Error('Unknown error occurred while calling Gemini API');
    }
  }

  private getSystemPrompt(type: 'consulting' | 'product', difficulty: string): string {
    const basePrompt = `You are an expert case interview coach specializing in ${type} cases. `;
    
    const structuredPrompt = `Analyze this ${difficulty} difficulty case study and provide a COMPLETE, well-structured response.

CRITICAL: You must complete your entire analysis. Do not stop mid-sentence or mid-section.

Structure your response in exactly 4 sections:

## 1. FRAMEWORK & APPROACH (<=100 words)
- Identify the most appropriate framework for this case
- Explain why this framework fits the problem
- Outline your structured thinking approach
- List 3-5 key questions you would ask

## 2. KEY ANALYSIS (<=120 words)
- Break down the main issues to examine
- Identify critical data points needed
- State key assumptions clearly
- Highlight potential root causes
- Consider both quantitative and qualitative factors

## 3. RECOMMENDATIONS (<=100 words)
- Provide 3-5 specific, actionable recommendations
- Prioritize recommendations (quick wins vs long-term)
- Explain the rationale for each recommendation
- Include implementation considerations

## 4. RISKS & NEXT STEPS (<=80 words)
- Identify major risks and mitigation strategies
- Outline immediate next steps
- Define success metrics
- Suggest contingency plans

Tone: Clear, practical, MBA interview-style. Use bullet points where appropriate. Ensure you complete all 4 sections fully before ending your response.`;

    return basePrompt + structuredPrompt;
  }

  private parseAIResponse(response: string): GeminiResponse {
    // Extract structured components
    const frameworkMatch = response.match(/##\s*1\.\s*FRAMEWORK & APPROACH[\s\S]*?(?=##\s*2\.|$)/);
    const analysisMatch = response.match(/##\s*2\.\s*KEY ANALYSIS[\s\S]*?(?=##\s*3\.|$)/);
    const recommendationsMatch = response.match(/##\s*3\.\s*RECOMMENDATIONS[\s\S]*?(?=##\s*4\.|$)/);

    return {
      content: response,
      framework: frameworkMatch ? frameworkMatch[0].trim() : undefined,
      keyInsights: analysisMatch ? 
        analysisMatch[0].split('\n').filter(line => line.trim().startsWith('-')).map(line => line.trim()) : 
        undefined,
      recommendations: recommendationsMatch ? 
        recommendationsMatch[0].split('\n').filter(line => line.trim().startsWith('-')).map(line => line.trim()) : 
        undefined,
    };
  }

  async generateInsightsForAnswer(
    questionTitle: string,
    questionDescription: string,
    userAnswer: string
  ): Promise<string> {
    if (!this.apiKey) {
      throw new Error('Gemini API key not configured');
    }

    const prompt = `You are an expert case study evaluator. Analyze the user's response and provide constructive feedback.

Case Study: ${questionTitle}

Problem: ${questionDescription}

Student's Answer: ${userAnswer}

Provide feedback in 4 concise sections (complete all sections):

1. STRENGTHS (2-3 points)
2. AREAS FOR IMPROVEMENT (2-3 points)
3. MISSING CONSIDERATIONS (2-3 points)
4. FRAMEWORK SUGGESTIONS (1-2 specific frameworks)

Be encouraging but constructive. Keep total response under 500 words.`;

    try {
      const requestBody = {
        contents: [{
          parts: [{
            text: prompt
          }]
        }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 2048, // Increased from 1024
        },
        safetySettings: [
          {
            category: "HARM_CATEGORY_HARASSMENT",
            threshold: "BLOCK_MEDIUM_AND_ABOVE"
          },
          {
            category: "HARM_CATEGORY_HATE_SPEECH",
            threshold: "BLOCK_MEDIUM_AND_ABOVE"
          },
          {
            category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
            threshold: "BLOCK_MEDIUM_AND_ABOVE"
          },
          {
            category: "HARM_CATEGORY_DANGEROUS_CONTENT",
            threshold: "BLOCK_MEDIUM_AND_ABOVE"
          }
        ]
      };

      const response = await fetch(`${this.baseUrl}?key=${this.apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.text();
        console.error('Gemini API error:', errorData);
        throw new Error(`Gemini API error: ${response.status}`);
      }

      const data = await response.json();
      
      if (!data?.candidates?.[0]?.content?.parts?.[0]?.text) {
        console.error('Invalid response structure for insights:', data);
        throw new Error('Invalid response format from Gemini API');
      }

      return data.candidates[0].content.parts[0].text;
    } catch (error) {
      console.error('Gemini API error:', error);
      throw new Error('Failed to generate feedback');
    }
  }

  async testAPIKey(): Promise<boolean> {
    if (!this.apiKey) {
      console.log('No API key provided');
      return false;
    }

    try {
      const requestBody = {
        contents: [{
          parts: [{
            text: 'Hello, please respond with "API test successful"'
          }]
        }],
        generationConfig: {
          maxOutputTokens: 50,
          temperature: 0.1
        }
      };

      const response = await fetch(`${this.baseUrl}?key=${this.apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('API test failed:', response.status, errorText);
        return false;
      }

      const data = await response.json();
      const hasValidResponse = !!(data?.candidates?.[0]?.content?.parts?.[0]?.text);
      
      if (hasValidResponse) {
        console.log('✅ API test SUCCESS');
      } else {
        console.log('❌ API test FAILED - Invalid response structure');
      }
      
      return hasValidResponse;
    } catch (error) {
      console.error('API test error:', error);
      return false;
    }
  }

  async testSimpleGeneration(): Promise<string> {
    if (!this.apiKey) {
      throw new Error('API key not configured');
    }

    try {
      const response = await fetch(`${this.baseUrl}?key=${this.apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: 'Explain the profitability framework in consulting in 3 sentences.'
            }]
          }]
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      }

      const data = await response.json();
      
      if (data?.candidates?.[0]?.content?.parts?.[0]?.text) {
        return data.candidates[0].content.parts[0].text;
      } else {
        throw new Error('Invalid response structure: ' + JSON.stringify(data));
      }
    } catch (error) {
      throw new Error(`Simple generation failed: ${error}`);
    }
  }

  getFallbackResponse(questionTitle: string, questionDescription: string, questionType: string, difficulty: string): GeminiResponse {
    return {
      content: `# Analysis for: ${questionTitle}

## 1. FRAMEWORK & APPROACH
This ${questionType} case study presents a ${difficulty}-level challenge that requires systematic analysis.

**Recommended Framework:**
- Problem Definition: Clearly articulate the core issue and stakeholders
- Structured Analysis: Use relevant framework (profitability, market entry, operations, etc.)
- Hypothesis Development: Create testable assumptions about root causes or solutions
- Data-Driven Validation: Gather evidence to support or refute hypotheses

**Key Questions to Ask:**
- What are the underlying root causes?
- What data is available vs. what do we need?
- Who are the key stakeholders affected?
- What are the constraints and boundaries?

## 2. KEY ANALYSIS
**Primary Issues to Examine:**
- Industry dynamics and competitive landscape
- Financial implications and resource requirements
- Operational considerations and constraints
- Customer needs and market positioning
- Risk factors and mitigation strategies

**Critical Assumptions:**
- Market conditions remain stable
- Resources are available for implementation
- Stakeholders are aligned on objectives
- Timeline is realistic and achievable

## 3. RECOMMENDATIONS
**Immediate Actions:**
- Prioritize quick wins that demonstrate value
- Gather additional data to validate hypotheses
- Engage stakeholders early and often

**Long-term Strategy:**
- Develop comprehensive implementation roadmap
- Build capabilities for sustainable change
- Establish metrics and monitoring systems

**Implementation Considerations:**
- Change management and communication plan
- Resource allocation and budget requirements
- Timeline with clear milestones

## 4. RISKS & NEXT STEPS
**Major Risks:**
- Market conditions change unexpectedly
- Resource constraints impact execution
- Stakeholder resistance to change
- Implementation complexity underestimated

**Mitigation Strategies:**
- Regular monitoring and course correction
- Flexible approach with contingency plans
- Strong stakeholder communication
- Phased implementation approach

**Next Steps:**
- Validate assumptions with additional data
- Develop detailed implementation plan
- Secure stakeholder buy-in
- Establish success metrics and KPIs

*Note: This is a structured template. For AI-generated personalized analysis, please ensure your API connection is configured properly.*`,
      framework: 'Structured Problem Solving Framework',
      keyInsights: [
        'Define the problem clearly before jumping to solutions',
        'Use data-driven analysis to validate assumptions',
        'Consider multiple stakeholder perspectives',
        'Balance short-term wins with long-term strategy',
        'Plan for implementation challenges and risks'
      ],
      recommendations: [
        'Start with problem definition and stakeholder analysis',
        'Choose appropriate analytical framework for the case type',
        'Develop and test hypotheses systematically',
        'Create actionable recommendations with clear next steps',
        'Define success metrics for implementation tracking'
      ]
    };
  }
}

export const geminiService = new GeminiService();

// // lib/gemini.ts
// // https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent

// export interface GeminiResponse {
//   content: string;
//   framework?: string;
//   keyInsights?: string[];
//   recommendations?: string[];
// }

// export class GeminiService {
//   private apiKey: string;
//   private baseUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

//   constructor() {
//     // Check for various possible environment variable names
//     this.apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY || 
//                   process.env.VITE_GEMINI_API_KEY ||
//                   '';
    
//     if (!this.apiKey) {
//       console.warn('Gemini API key not found. AI features will be disabled.');
//       console.warn('Please set NEXT_PUBLIC_GEMINI_API_KEY or VITE_GEMINI_API_KEY environment variable');
//     }
//   }

//   async generateCaseStudyResponse(
//     questionTitle: string,
//     questionDescription: string,
//     questionType: 'consulting' | 'product',
//     difficulty: 'easy' | 'medium' | 'hard'
//   ): Promise<GeminiResponse> {
//     if (!this.apiKey) {
//       throw new Error('Gemini API key not configured');
//     }

//     const systemPrompt = this.getSystemPrompt(questionType, difficulty);
//     const userPrompt = `Case Study: ${questionTitle}\n\n${questionDescription}`;
//     const fullPrompt = `${systemPrompt}\n\n${userPrompt}`;

//     console.log('🤖 Making Gemini API request...');

//     try {
//       const requestBody = {
//         contents: [{
//           parts: [{
//             text: fullPrompt
//           }]
//         }],
//         generationConfig: {
//           temperature: 0.7,
//           topK: 40,
//           topP: 0.95,
//           maxOutputTokens: 4096,
//           stopSequences: [],
//         },
//         safetySettings: [
//           {
//             category: "HARM_CATEGORY_HARASSMENT",
//             threshold: "BLOCK_MEDIUM_AND_ABOVE"
//           },
//           {
//             category: "HARM_CATEGORY_HATE_SPEECH",
//             threshold: "BLOCK_MEDIUM_AND_ABOVE"
//           },
//           {
//             category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
//             threshold: "BLOCK_MEDIUM_AND_ABOVE"
//           },
//           {
//             category: "HARM_CATEGORY_DANGEROUS_CONTENT",
//             threshold: "BLOCK_MEDIUM_AND_ABOVE"
//           }
//         ]
//       };

//       console.log('📤 Request body:', JSON.stringify(requestBody, null, 2));

//       const response = await fetch(`${this.baseUrl}?key=${this.apiKey}`, {
//         method: 'POST',
//         headers: {
//           'Content-Type': 'application/json',
//         },
//         body: JSON.stringify(requestBody),
//       });

//       console.log('📡 Gemini Response Status:', response.status);

//       if (!response.ok) {
//         const errorData = await response.text();
//         console.error('❌ Gemini API Error Response:', errorData);
        
//         if (response.status === 400) {
//           throw new Error('Invalid request to Gemini API. Please check your request format.');
//         } else if (response.status === 403) {
//           throw new Error('Invalid Gemini API key or insufficient permissions.');
//         } else if (response.status === 429) {
//           throw new Error('Gemini API rate limit exceeded. Please try again later.');
//         } else if (response.status === 404) {
//           throw new Error('Gemini API endpoint not found. Please check the model name.');
//         } else {
//           throw new Error(`Gemini API error: ${response.status} - ${errorData}`);
//         }
//       }

//       const data = await response.json();
//       console.log('📥 Raw Gemini response:', JSON.stringify(data, null, 2));

//       // Comprehensive validation of response structure
//       if (!data) {
//         console.error('No data received from Gemini API');
//         return this.getFallbackResponse(questionTitle, questionDescription, questionType, difficulty);
//       }

//       // Check for API errors in response
//       if (data.error) {
//         console.error('Gemini API returned error:', data.error);
//         throw new Error(`Gemini API error: ${data.error.message || 'Unknown error'}`);
//       }

//       if (!data.candidates) {
//         console.error('No candidates in Gemini response:', data);
//         return this.getFallbackResponse(questionTitle, questionDescription, questionType, difficulty);
//       }

//       if (!Array.isArray(data.candidates) || data.candidates.length === 0) {
//         console.error('Empty candidates array:', data.candidates);
//         return this.getFallbackResponse(questionTitle, questionDescription, questionType, difficulty);
//       }

//       const candidate = data.candidates[0];
//       if (!candidate) {
//         console.error('First candidate is null/undefined');
//         return this.getFallbackResponse(questionTitle, questionDescription, questionType, difficulty);
//       }

//       // Check for safety blocks or other finish reasons
//       if (candidate.finishReason === 'SAFETY') {
//         console.warn('Response blocked for safety reasons');
//         return this.getFallbackResponse(questionTitle, questionDescription, questionType, difficulty);
//       }

//       if (candidate.finishReason === 'RECITATION') {
//         console.warn('Response blocked for recitation');
//         return this.getFallbackResponse(questionTitle, questionDescription, questionType, difficulty);
//       }

//       if (!candidate.content) {
//         console.error('No content in candidate:', candidate);
//         return this.getFallbackResponse(questionTitle, questionDescription, questionType, difficulty);
//       }

//       if (!candidate.content.parts) {
//         console.error('No parts in content:', candidate.content);
//         return this.getFallbackResponse(questionTitle, questionDescription, questionType, difficulty);
//       }

//       if (!Array.isArray(candidate.content.parts) || candidate.content.parts.length === 0) {
//         console.error('Empty parts array:', candidate.content.parts);
//         return this.getFallbackResponse(questionTitle, questionDescription, questionType, difficulty);
//       }

//       const part = candidate.content.parts[0];
//       if (!part) {
//         console.error('First part is null/undefined');
//         return this.getFallbackResponse(questionTitle, questionDescription, questionType, difficulty);
//       }

//       if (!part.text) {
//         console.error('No text in part:', part);
//         return this.getFallbackResponse(questionTitle, questionDescription, questionType, difficulty);
//       }

//       const aiResponse = part.text;
//       console.log('✅ Gemini API Success - Response length:', aiResponse.length);
      
//       return this.parseAIResponse(aiResponse);

//     } catch (error) {
//       console.error('❌ Gemini API error:', error);
      
//       // Re-throw the error with additional context
//       if (error instanceof Error) {
//         throw new Error(`Gemini API Error: ${error.message}`);
//       }
//       throw new Error('Unknown error occurred while calling Gemini API');
//     }
//   }

//   private getSystemPrompt(type: 'consulting' | 'product', difficulty: string): string {
//     const basePrompt = `You are an expert case interview coach specializing in ${type} cases. `;
    
//     const simplePrompt = `Analyze this ${difficulty} difficulty case study and provide a structured response.

// Please structure your analysis as follows:

// FRAMEWORK & APPROACH:
// - What framework would you use?
// - How would you structure your thinking?

// KEY ANALYSIS:
// - What are the main issues to examine?
// - What data would you need?
// - What are the key assumptions?

// RECOMMENDATIONS:
// - What would you recommend?
// - Why is this the best approach?
// - What are the risks and mitigation strategies?

// Keep your response clear, practical, and educational for interview preparation.`;

//     return basePrompt + simplePrompt;
//   }

//   private parseAIResponse(response: string): GeminiResponse {
//     // Try to extract structured components from the response
//     const frameworkMatch = response.match(/\*\*FRAMEWORK & APPROACH:\*\*([\s\S]*?)(?=\*\*|$)/);
//     const keyInsightsMatch = response.match(/\*\*KEY ANALYSIS POINTS:\*\*([\s\S]*?)(?=\*\*|$)/);
//     const recommendationsMatch = response.match(/\*\*RECOMMENDATIONS:\*\*([\s\S]*?)(?=\*\*|$)/);

//     return {
//       content: response,
//       framework: frameworkMatch ? frameworkMatch[1].trim() : undefined,
//       keyInsights: keyInsightsMatch ? 
//         keyInsightsMatch[1].trim().split('\n').filter(line => line.trim()) : 
//         undefined,
//       recommendations: recommendationsMatch ? 
//         recommendationsMatch[1].trim().split('\n').filter(line => line.trim()) : 
//         undefined,
//     };
//   }

//   // Method to generate quick insights for existing user answers
//   async generateInsightsForAnswer(
//     questionTitle: string,
//     questionDescription: string,
//     userAnswer: string
//   ): Promise<string> {
//     if (!this.apiKey) {
//       throw new Error('Gemini API key not configured');
//     }

//     const prompt = `You are an expert case study evaluator. Analyze the user's response to a case study and provide constructive feedback.

// Case Study: ${questionTitle}

// Problem: ${questionDescription}

// Student's Answer: ${userAnswer}

// Please provide constructive feedback focusing on:
// 1. Strengths in their approach
// 2. Areas for improvement
// 3. Missing considerations
// 4. Framework suggestions

// Be encouraging but constructive. Keep your feedback concise and actionable.`;

//     try {
//       const requestBody = {
//         contents: [{
//           parts: [{
//             text: prompt
//           }]
//         }],
//         generationConfig: {
//           temperature: 0.7,
//           maxOutputTokens: 1024,
//         },
//         safetySettings: [
//           {
//             category: "HARM_CATEGORY_HARASSMENT",
//             threshold: "BLOCK_MEDIUM_AND_ABOVE"
//           },
//           {
//             category: "HARM_CATEGORY_HATE_SPEECH",
//             threshold: "BLOCK_MEDIUM_AND_ABOVE"
//           },
//           {
//             category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
//             threshold: "BLOCK_MEDIUM_AND_ABOVE"
//           },
//           {
//             category: "HARM_CATEGORY_DANGEROUS_CONTENT",
//             threshold: "BLOCK_MEDIUM_AND_ABOVE"
//           }
//         ]
//       };

//       const response = await fetch(`${this.baseUrl}?key=${this.apiKey}`, {
//         method: 'POST',
//         headers: {
//           'Content-Type': 'application/json',
//         },
//         body: JSON.stringify(requestBody),
//       });

//       if (!response.ok) {
//         const errorData = await response.text();
//         console.error('Gemini API error:', errorData);
//         throw new Error(`Gemini API error: ${response.status}`);
//       }

//       const data = await response.json();
      
//       // Apply the same validation as in the main method
//       if (!data?.candidates?.[0]?.content?.parts?.[0]?.text) {
//         console.error('Invalid response structure for insights:', data);
//         throw new Error('Invalid response format from Gemini API');
//       }

//       return data.candidates[0].content.parts[0].text;
//     } catch (error) {
//       console.error('Gemini API error:', error);
//       throw new Error('Failed to generate feedback');
//     }
//   }

//   // Test method to validate API key
//   async testAPIKey(): Promise<boolean> {
//     if (!this.apiKey) {
//       console.log('No API key provided');
//       return false;
//     }

//     try {
//       const requestBody = {
//         contents: [{
//           parts: [{
//             text: 'Hello, please respond with "API test successful"'
//           }]
//         }],
//         generationConfig: {
//           maxOutputTokens: 50,
//           temperature: 0.1
//         }
//       };

//       console.log('Testing API with:', this.baseUrl);
//       console.log('Request body:', JSON.stringify(requestBody, null, 2));

//       const response = await fetch(`${this.baseUrl}?key=${this.apiKey}`, {
//         method: 'POST',
//         headers: {
//           'Content-Type': 'application/json',
//         },
//         body: JSON.stringify(requestBody),
//       });

//       console.log('Test response status:', response.status);

//       if (!response.ok) {
//         const errorText = await response.text();
//         console.error('API test failed with status:', response.status);
//         console.error('Error response:', errorText);
//         return false;
//       }

//       const data = await response.json();
//       console.log('Test response data:', JSON.stringify(data, null, 2));
      
//       const hasValidResponse = !!(data?.candidates?.[0]?.content?.parts?.[0]?.text);
      
//       if (hasValidResponse) {
//         console.log('✅ API test SUCCESS');
//         console.log('Test response text:', data.candidates[0].content.parts[0].text);
//       } else {
//         console.log('❌ API test FAILED - Invalid response structure');
//       }
      
//       return hasValidResponse;
//     } catch (error) {
//       console.error('API test error:', error);
//       return false;
//     }
//   }

//   // Simple method to test with minimal request
//   async testSimpleGeneration(): Promise<string> {
//     if (!this.apiKey) {
//       throw new Error('API key not configured');
//     }

//     try {
//       const response = await fetch(`${this.baseUrl}?key=${this.apiKey}`, {
//         method: 'POST',
//         headers: {
//           'Content-Type': 'application/json',
//         },
//         body: JSON.stringify({
//           contents: [{
//             parts: [{
//               text: 'Explain the profitability framework in consulting in 3 sentences.'
//             }]
//           }]
//         }),
//       });

//       if (!response.ok) {
//         throw new Error(`HTTP ${response.status}: ${await response.text()}`);
//       }

//       const data = await response.json();
      
//       if (data?.candidates?.[0]?.content?.parts?.[0]?.text) {
//         return data.candidates[0].content.parts[0].text;
//       } else {
//         throw new Error('Invalid response structure: ' + JSON.stringify(data));
//       }
//     } catch (error) {
//       throw new Error(`Simple generation failed: ${error}`);
//     }
//   }

//   // Helper method to get fallback response when API fails
//   getFallbackResponse(questionTitle: string, questionDescription: string, questionType: string, difficulty: string): GeminiResponse {
//     return {
//       content: `# Analysis for: ${questionTitle}

// ## Problem Overview
// This ${questionType} case study presents a ${difficulty}-level challenge that requires systematic analysis.

// ## Suggested Approach

// ### **FRAMEWORK & APPROACH:**
// - **Problem Definition**: Clearly articulate the core issue and stakeholders
// - **Structured Analysis**: Use relevant framework (profitability, market entry, operations, etc.)
// - **Hypothesis Development**: Create testable assumptions about root causes or solutions
// - **Data-Driven Validation**: Gather evidence to support or refute hypotheses
// - **Solution Development**: Generate actionable recommendations

// ### **KEY ANALYSIS POINTS:**
// - Industry dynamics and competitive landscape
// - Financial implications and resource requirements
// - Operational considerations and constraints
// - Customer needs and market positioning
// - Risk factors and mitigation strategies

// ### **RECOMMENDATIONS:**
// - Prioritize quick wins vs. long-term strategic initiatives
// - Develop implementation timeline with clear milestones
// - Define success metrics and KPIs for measuring progress
// - Consider change management and stakeholder buy-in
// - Plan for contingencies and alternative scenarios

// ### **ADDITIONAL INSIGHTS:**
// - Consider both quantitative and qualitative factors
// - Look for synergies and unintended consequences
// - Evaluate scalability and sustainability of solutions
// - Assess competitive response and market dynamics
// - Plan for measurement and continuous improvement

// *Note: This is a structured approach template generated when AI services are unavailable. For personalized analysis, please ensure your API connection is working properly.*`,
//       framework: 'Structured Problem Solving Framework',
//       keyInsights: [
//         'Define the problem clearly before jumping to solutions',
//         'Use data-driven analysis to validate assumptions',
//         'Consider multiple stakeholder perspectives',
//         'Balance short-term wins with long-term strategy',
//         'Plan for implementation challenges and risks'
//       ],
//       recommendations: [
//         'Start with problem definition and stakeholder analysis',
//         'Choose appropriate analytical framework for the case type',
//         'Develop and test hypotheses systematically',
//         'Create actionable recommendations with clear next steps',
//         'Define success metrics for implementation tracking'
//       ]
//     };
//   }
// }

// export const geminiService = new GeminiService();