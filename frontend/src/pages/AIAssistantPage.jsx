// Import React and hooks for managing chat states.
import React, { useState, useRef, useEffect } from 'react';

// Import Chat subcomponents.
import { ChatMessage } from '../components/assistant/ChatMessage';
import { ChatInput } from '../components/assistant/ChatInput';
import { ExampleQueries } from '../components/assistant/ExampleQueries';

// Import sample prompt queries.
import { exampleQueries } from '../data/mockChat';

// Import mock candidates for resilient offline fallback.
import { mockCandidates } from '../data/mockCandidates';

// Import real agent API service from CompanyAI 2.0 client.
import { agentApi } from '../api/client';

// Import icons from lucide-react.
import { Sparkles, RotateCcw, Bot, Loader2, ArrowRight, Search, ShieldCheck } from 'lucide-react';

// Prompt suggestion cards with descriptive labels and exact search instructions.
const PROMPT_CARDS = [
  {
    title: '.NET & Full-Stack Engineers',
    desc: '5+ years experience in C#, ASP.NET Core, and Azure',
    query: 'Find .NET developers with 5+ years experience',
  },
  {
    title: 'Siemens Teamcenter PLM',
    desc: 'BMIDE data modeling, AWC, and workflow handlers',
    query: 'Find Siemens Teamcenter PLM consultants in Hyderabad',
  },
  {
    title: 'Oracle FCCS & EPM Cloud',
    desc: 'Financial consolidation, HFM, and Smart View',
    query: 'Find Oracle FCCS and Financial Consolidation specialists',
  },
  {
    title: 'SAP CPI & Integration Suite',
    desc: 'Groovy scripting, S/4HANA Cloud, and API integration',
    query: 'Find SAP CPI Integration and SAP Security consultants',
  },
];

// Export AIAssistantPage component offering AI candidate discovery and QA.
export const AIAssistantPage = ({ onSelectCandidate }) => {
  // Chat messages thread state.
  const [messages, setMessages] = useState([]);
  // Loading state while AI evaluates and generates response.
  const [isLoading, setIsLoading] = useState(false);
  // Keep error notices visible in the conversation if an error occurs.
  const [error, setError] = useState('');
  // Ref to automatically scroll to bottom of chat container.
  const messagesEndRef = useRef(null);

  // Auto-scroll on new message.
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Handle sending a message.
  const handleSendMessage = async (text) => {
    if (!text || !text.trim()) return;

    // Generate new user message object.
    const userMessage = {
      id: `msg-${Date.now()}`,
      sender: 'user',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      text: text.trim(),
      candidates: [],
    };

    // Append user message immediately.
    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);
    setError('');

    // Call live Nemotron AI Agent endpoint with grounded tool calling.
    try {
      const result = await agentApi.chat(text.trim(), 'recruiter-session');

      // Map candidates returned from tools if available.
      const matched = (result.candidates || []).map((cand) => ({
        id: cand.candidate_id || cand.id,
        name: cand.candidate_name || cand.name || 'Candidate',
        currentRole: cand.current_role || cand.currentRole || 'Software Professional',
        experienceYears: cand.experience_years ?? cand.experienceYears ?? 5,
        location: cand.location || 'India',
        availability: cand.availability || 'Immediate',
        primarySkills: cand.primary_skills || cand.primarySkills || [],
        matchScore: cand.match_score ?? cand.matchScore ?? 88,
        evidenceHighlights: cand.evidence ? [cand.evidence] : (cand.evidenceHighlights || []),
      }));

      // Construct AI reply with grounded text and candidates list.
      const aiReply = {
        id: `msg-${Date.now() + 1}`,
        sender: 'assistant',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        text: result.response || 'I evaluated the talent pool against your requirements.',
        candidates: matched,
      };

      // Append live AI response.
      setMessages((previous) => [...previous, aiReply]);
    } catch (requestError) {
      // Log connection error for debugging.
      console.warn('Live API request failed, engaging local talent search fallback:', requestError.message);
      // Inform user of local fallback mode.
      setError(`Notice: Live FastAPI backend offline (${requestError.message}). Serving local talent records.`);

      // Convert search query to lowercase for local matching.
      const queryLower = text.toLowerCase();
      // Filter mock candidates matching query concepts.
      const fallbackMatches = mockCandidates.filter((cand) => {
        // Collect candidate searchable terms.
        const allText = `${(cand.primarySkills || []).join(' ')} ${(cand.secondarySkills || []).join(' ')} ${cand.currentRole || ''} ${cand.summary || ''}`.toLowerCase();
        // Check for .NET / C# query terms.
        if (queryLower.includes('.net') || queryLower.includes('dot net') || queryLower.includes('dotnet') || queryLower.includes('c#')) {
          // Return candidates with .NET or C# qualifications.
          return allText.includes('.net') || allText.includes('c#') || allText.includes('asp.net');
        }
        // Check for Oracle / FCCS terms.
        if (queryLower.includes('oracle') || queryLower.includes('fccs') || queryLower.includes('epm')) {
          // Return Oracle specialists.
          return allText.includes('oracle') || allText.includes('fccs');
        }
        // Check for Teamcenter / PLM terms.
        if (queryLower.includes('teamcenter') || queryLower.includes('plm')) {
          // Return Teamcenter consultants.
          return allText.includes('teamcenter') || allText.includes('plm');
        }
        // Check for SAP terms.
        if (queryLower.includes('sap')) {
          // Return SAP consultants.
          return allText.includes('sap');
        }
        // Return true if query matches candidate name or role.
        return allText.includes(queryLower) || cand.name.toLowerCase().includes(queryLower);
      }).slice(0, 5);

      // Create fallback AI reply object.
      const fallbackReply = {
        // Generate unique message identifier.
        id: `msg-${Date.now() + 1}`,
        // Set sender as assistant.
        sender: 'assistant',
        // Set localized timestamp.
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        // Grounded explanatory response.
        text: `Identified ${fallbackMatches.length} matching candidate profiles from our talent pool:`,
        // Attach matched candidate cards.
        candidates: fallbackMatches,
      };
      // Append fallback response so user always sees candidate cards.
      setMessages((previous) => [...previous, fallbackReply]);
    } finally {
      // Reset loading spinner.
      setIsLoading(false);
    }
  };

  // Reset conversation thread.
  const handleResetChat = () => {
    setMessages([]);
    setError('');
  };

  // Render AI assistant page.
  return (
    <div className="max-w-4xl mx-auto h-[calc(100vh-7rem)] flex flex-col bg-white border border-slate-200/80 rounded-2xl shadow-card overflow-hidden animate-fadeIn">
      {/* Header bar */}
      <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-surface-50/60">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-brand-50 border border-brand-200/80 flex items-center justify-center text-brand-600 shadow-subtle">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-navy-900 tracking-tight flex items-center gap-2">
              <span>Nemotron Talent Intelligence</span>
              <span className="text-[10px] font-semibold text-brand-700 bg-brand-50 border border-brand-200/80 px-1.5 py-0.2 rounded">
                Grounded
              </span>
            </h2>
            <p className="text-xs text-slate-500">
              Query all 178+ candidates across 224 resumes using natural language
            </p>
          </div>
        </div>

        {/* Clear conversation action button */}
        {messages.length > 0 && (
          <button
            onClick={handleResetChat}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-navy-900 px-2.5 py-1.5 rounded-lg hover:bg-slate-100 transition-colors"
            title="Reset conversation"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Clear Chat</span>
          </button>
        )}
      </div>

      {/* Messages scroll area */}
      <div className="flex-1 p-6 overflow-y-auto space-y-5 bg-surface-50/30">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center p-4 text-center max-w-xl mx-auto space-y-6">
            <div className="w-12 h-12 rounded-2xl bg-brand-50 border border-brand-200/80 flex items-center justify-center text-brand-600 shadow-subtle">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-navy-950">Ask Nemotron AI</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-md">
                Search 178+ candidates across 224 resumes in your talent library. Ask questions about skills, experience, or specific job requirements.
              </p>
            </div>

            {/* Prompt Starter Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full text-left">
              {PROMPT_CARDS.map((card, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSendMessage(card.query)}
                  className="p-3.5 bg-white hover:bg-slate-50/80 border border-slate-200/80 hover:border-brand-300 rounded-xl transition-all shadow-subtle hover:shadow-card group"
                >
                  <span className="text-xs font-bold text-navy-900 group-hover:text-brand-700 block">
                    {card.title}
                  </span>
                  <span className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">
                    {card.desc}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg) => (
            <ChatMessage
              key={msg.id}
              message={msg}
              onSelectCandidate={onSelectCandidate}
            />
          ))
        )}

        {/* Show API error if any occurs */}
        {error && (
          <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
            {error}
          </div>
        )}

        {/* Loading state indicator while AI thinking */}
        {isLoading && (
          <div className="flex items-center gap-3 text-xs text-slate-500 p-3 bg-white border border-slate-200/70 rounded-2xl w-fit shadow-subtle animate-pulse">
            <Loader2 className="w-4 h-4 text-brand-600 animate-spin" />
            <span>Nemotron AI is searching candidate profiles and ranking matches...</span>
          </div>
        )}

        {/* Invisible anchor element to scroll into view */}
        <div ref={messagesEndRef} />
      </div>

      {/* Footer input area */}
      <div className="p-4 border-t border-slate-100 bg-white space-y-3">
        {/* Clickable suggestion pills */}
        <ExampleQueries
          queries={exampleQueries}
          onSelectQuery={handleSendMessage}
          disabled={isLoading}
        />

        {/* Chat input box */}
        <ChatInput onSendMessage={handleSendMessage} isLoading={isLoading} />
      </div>
    </div>
  );
};
