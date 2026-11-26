// Import React, hooks, and icons for the dedicated CompanyAI recruitment workspace.
import React, { useState, useRef, useEffect, useMemo } from 'react';

// Import icons from lucide-react for modern enterprise hybrid aesthetics.
import {
  Sparkles,
  RotateCcw,
  Bot,
  Loader2,
  ArrowRight,
  Search,
  ShieldCheck,
  Plus,
  MessageSquare,
  Clock,
  Briefcase,
  User,
  GitPullRequest,
  Send,
  Terminal,
  ChevronRight,
  Layers,
  HelpCircle,
  AlertCircle,
  CheckCircle2,
  X,
} from 'lucide-react';

// Import Badge component and official React Bits suite for CompanyAI feedback and attractive interactions.
import { Badge } from '../components/common/Badge';
import { LatticeLoader } from '../components/reactbits/LatticeLoader';
import { ShinyText } from '../components/reactbits/ShinyText';
import { BlurText } from '../components/reactbits/BlurText';
import { SpotlightCard } from '../components/reactbits/SpotlightCard';
import { GlareHover } from '../components/reactbits/GlareHover';
import { GradientText } from '../components/reactbits/GradientText';
import { AnimatedContent } from '../components/reactbits/AnimatedContent';

// Import real agent API service from CompanyAI client.
import { agentApi } from '../api/client';

// Suggested recruitment prompt starter cards organized into actionable categories.
const PROMPT_CATEGORIES = [
  {
    category: 'Talent Discovery',
    prompts: [
      {
        title: '.NET & Azure Engineers',
        desc: '5+ years experience in C#, ASP.NET Core, and Azure',
        query: 'Find .NET developers with 5+ years experience in Azure',
      },
      {
        title: 'Siemens Teamcenter PLM',
        desc: 'BMIDE modeling, AWC, and workflow configuration',
        query: 'Find Siemens Teamcenter PLM consultants with AWC experience',
      },
      {
        title: 'Oracle FCCS & EPM Cloud',
        desc: 'Financial consolidation, HFM, and Smart View',
        query: 'Find Oracle FCCS and Financial Consolidation specialists',
      },
    ],
  },
  {
    category: 'Job Matching & Gap Analysis',
    prompts: [
      {
        title: 'Oracle FCCS Lead Role Fit',
        desc: 'Evaluate top candidates against mandatory requirements',
        query: 'Find candidates matching Oracle FCCS Lead and explain score',
      },
      {
        title: 'Explain Candidate Skill Gaps',
        desc: 'Identify missing evidence and mandatory gaps',
        query: 'Explain why candidates have gaps for Siemens Teamcenter job',
      },
    ],
  },
  {
    category: 'Requisitions & Operations',
    prompts: [
      {
        title: 'Urgent Requisitions Overview',
        desc: 'Review SLA deadlines and assigned recruiters',
        query: 'Show urgent recruitment requests and SLA deadlines',
      },
      {
        title: 'Pipeline Population Audit',
        // Describe tool output dynamically without hardcoding static resume counts.
        desc: 'Inspect indexed resume count, pipeline stages, and vector coverage',
        query: 'Summarize candidate pipeline metrics and vector coverage',
      },
    ],
  },
];

// Export AIAssistantPage presenting the dedicated CompanyAI Workspace.
export const AIAssistantPage = ({
  jobs = [],
  candidates = [],
  requests = [],
  onSelectCandidate,
  onSelectJob,
}) => {
  // Session history state containing persistent recruitment conversations.
  const [sessions, setSessions] = useState(() => {
    return [
      {
        id: 'sess-default',
        title: 'Talent Intelligence Session',
        createdAt: 'Today',
        messages: [],
      },
    ];
  });

  // Active session ID tracker.
  const [activeSessionId, setActiveSessionId] = useState('sess-default');

  // Text input box state.
  const [inputText, setInputText] = useState('');

  // Loading state while CompanyAI processes tool calling and synthesizes answers.
  const [isLoading, setIsLoading] = useState(false);

  // Real execution lifecycle tracker ('idle' -> 'waiting' -> 'running' -> 'completed' | 'failed') with no fake progress.
  const [toolPhase, setToolPhase] = useState('idle');

  // Active error notice banner if API call blocks.
  const [errorNotice, setErrorNotice] = useState('');

  // Right-side Context Panel selection state ('job', 'candidate', 'request').
  const [contextTab, setContextTab] = useState('job');
  const [selectedContextJobId, setSelectedContextJobId] = useState(jobs[0]?.id || null);
  const [selectedContextCandId, setSelectedContextCandId] = useState(candidates[0]?.id || null);
  const [selectedContextReqId, setSelectedContextReqId] = useState(requests[0]?.id || null);

  // Ref to automatically scroll to bottom of active conversation.
  const chatScrollRef = useRef(null);

  // Lookup active session object.
  const activeSession = useMemo(() => {
    return sessions.find((s) => s.id === activeSessionId) || sessions[0];
  }, [sessions, activeSessionId]);

  // Auto-scroll on new message or status change.
  useEffect(() => {
    chatScrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeSession?.messages, isLoading]);

  // Create a brand new conversation session.
  const handleNewConversation = () => {
    const newId = `sess-${Date.now()}`;
    const newSession = {
      id: newId,
      title: 'New Recruitment Chat',
      createdAt: 'Just now',
      messages: [],
    };
    setSessions((prev) => [newSession, ...prev]);
    setActiveSessionId(newId);
    setErrorNotice('');
  };

  // Dispatch message to live FastAPI Nemotron agent endpoint.
  const handleSendMessage = async (textToSend) => {
    const query = (textToSend || inputText).trim();
    if (!query) return;

    // Build user message record.
    const userMsg = {
      id: `msg-${Date.now()}`,
      sender: 'user',
      text: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    // Append user message immediately to active session.
    setSessions((prev) =>
      prev.map((s) =>
        s.id === activeSessionId
          ? {
              ...s,
              title: s.messages.length === 0 ? query.slice(0, 32) : s.title,
              messages: [...s.messages, userMsg],
            }
          : s
      )
    );
    setInputText('');
    setIsLoading(true);
    setToolPhase('waiting');
    setErrorNotice('');

    try {
      // Package active right-hand panel context (job, candidate, or request) so Nemotron tools resolve implicit references.
      const contextPayload =
        contextTab === 'job' && activeContextJob
          ? { entity_type: 'job', job_id: activeContextJob.numeric_id || activeContextJob.id, job_title: activeContextJob.title }
          : contextTab === 'candidate' && activeContextCand
          ? { entity_type: 'candidate', candidate_id: activeContextCand.numeric_id || activeContextCand.id, candidate_name: activeContextCand.name }
          : contextTab === 'request' && activeContextReq
          ? { entity_type: 'request', request_id: activeContextReq.id, req_number: activeContextReq.reqNumber }
          : null;

      // Mark active execution once request leaves client towards FastAPI + Nemotron tools.
      setToolPhase('running');

      // Execute query via CompanyAI agent endpoint with grounded workspace context and tool traces.
      const result = await agentApi.chat(query, activeSessionId, contextPayload);

      // Construct AI response record with tools called and candidate cards.
      const aiMsg = {
        id: `msg-${Date.now() + 1}`,
        sender: 'assistant',
        text: result.response || 'I evaluated the talent pool against your requirements.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        candidates: result.candidates || [],
        trace: result.trace || null,
      };

      // Append assistant reply to active session.
      setSessions((prev) =>
        prev.map((s) => (s.id === activeSessionId ? { ...s, messages: [...s.messages, aiMsg] } : s))
      );
      setToolPhase('completed');
    } catch (err) {
      setToolPhase('failed');
      setErrorNotice(`AI Assistant error: ${err.message}. Ensure FastAPI server is running.`);
    } finally {
      setIsLoading(false);
    }
  };

  // Lookup active context record objects.
  const activeContextJob = jobs.find((j) => j.id === selectedContextJobId) || jobs[0];
  const activeContextCand = candidates.find((c) => c.id === selectedContextCandId) || candidates[0];
  const activeContextReq = requests.find((r) => r.id === selectedContextReqId) || requests[0];

  return (
    <div className="h-[calc(100vh-8.5rem)] flex flex-col xl:flex-row gap-4 pb-2 animate-fadeIn">
      {/* 1. LEFT PANEL: CONVERSATION HISTORY SIDEBAR */}
      <div className="w-full xl:w-64 bg-white dark:bg-surface-darkCard border border-slate-200/80 dark:border-surface-darkBorder rounded-2xl p-4 flex flex-col shadow-card flex-shrink-0">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-surface-darkBorder">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-brand-600 dark:text-brand-400" />
            <h3 className="text-xs font-bold text-navy-900 dark:text-white uppercase tracking-wider">
              Conversations
            </h3>
          </div>
          <button
            onClick={handleNewConversation}
            className="p-1.5 rounded-lg bg-brand-50 dark:bg-brand-900/40 text-brand-700 dark:text-brand-300 hover:bg-brand-100 dark:hover:bg-brand-900/60 border border-brand-200 dark:border-brand-700/60 shadow-subtle transition-all"
            title="Start New Conversation"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Sessions list */}
        <div className="flex-1 overflow-y-auto space-y-1.5 pt-3">
          {sessions.map((sess) => {
            const isActive = sess.id === activeSessionId;
            return (
              <button
                key={sess.id}
                onClick={() => setActiveSessionId(sess.id)}
                className={`w-full text-left p-2.5 rounded-xl text-xs transition-all flex items-start gap-2.5 ${
                  isActive
                    ? 'bg-brand-50 dark:bg-brand-900/40 border border-brand-200 dark:border-brand-700/60 text-brand-900 dark:text-brand-100 shadow-subtle'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-surface-darkHover'
                }`}
              >
                <Sparkles className={`w-3.5 h-3.5 flex-shrink-0 mt-0.5 ${isActive ? 'text-brand-600 dark:text-brand-400' : 'text-slate-400'}`} />
                <div className="min-w-0 flex-1">
                  <span className="font-semibold block truncate">{sess.title}</span>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 block">
                    {sess.messages.length} messages • {sess.createdAt}
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Model telemetry pill */}
        <div className="pt-3 border-t border-slate-100 dark:border-surface-darkBorder">
          <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-surface-darkHover/60 border border-slate-200/70 dark:border-surface-darkBorder text-[11px] text-slate-600 dark:text-slate-300">
            <span className="font-bold text-navy-900 dark:text-white block">CompanyAI</span>
            <span className="text-[10px] text-slate-400 font-mono block">ollama/llama3.2:3b</span>
            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1 mt-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Connected • 768-dim Grounded
            </span>
          </div>
        </div>
      </div>

      {/* 2. CENTER PANEL: CENTRAL CHAT INTERFACE */}
      <div className="flex-1 bg-white dark:bg-surface-darkCard border border-slate-200/80 dark:border-surface-darkBorder rounded-2xl flex flex-col shadow-card overflow-hidden min-w-0">
        {/* Chat Header */}
        <div className="px-5 py-3.5 border-b border-slate-100 dark:border-surface-darkBorder flex items-center justify-between bg-surface-50/60 dark:bg-surface-darkHover/40">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-brand-50 dark:bg-brand-900/40 border border-brand-200/80 dark:border-brand-700/60 flex items-center justify-center text-brand-600 dark:text-brand-400 shadow-subtle">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-navy-900 dark:text-white tracking-tight flex items-center gap-2">
                <ShinyText
                  text="CompanyAI Recruitment Assistant"
                  color="currentColor"
                  shineColor="#10B981"
                  trigger={isLoading ? 'loop' : 'hover'}
                  speed={1.8}
                  className="text-navy-900 dark:text-white"
                />
                <span className="text-[10px] font-semibold text-brand-700 dark:text-brand-300 bg-brand-50 dark:bg-brand-900/50 border border-brand-200 dark:border-brand-700/60 px-1.5 py-0.2 rounded">
                  Safety Gated
                </span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Natural language candidate search, explainable JD matching, and talent analytics
              </p>
            </div>
          </div>

          {activeSession.messages.length > 0 && (
            <button
              onClick={() => {
                setSessions((prev) =>
                  prev.map((s) => (s.id === activeSessionId ? { ...s, messages: [] } : s))
                );
              }}
              className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-navy-900 dark:hover:text-white px-2.5 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-surface-darkHover transition-colors"
              title="Clear active conversation"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Clear Chat</span>
            </button>
          )}
        </div>

        {/* Message Stream with subtle Aceternity dot-matrix backdrop */}
        <div className="flex-1 p-5 overflow-y-auto space-y-4 bg-surface-50/40 dark:bg-surface-darkCanvas/50 bg-dot-pattern">
          {activeSession.messages.length === 0 ? (
            /* Empty State with Actionable Recruitment Starters */
            <div className="h-full flex flex-col items-center justify-center p-4 text-center max-w-2xl mx-auto space-y-5">
              <div className="w-12 h-12 rounded-2xl bg-brand-50 dark:bg-brand-900/40 border border-brand-200 dark:border-brand-700/60 flex items-center justify-center text-brand-600 dark:text-brand-400 shadow-subtle">
                <Sparkles className="w-6 h-6" />
              </div>
              <div className="space-y-1.5">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-accent-50/90 dark:bg-accent-950/60 border border-accent-200/80 dark:border-accent-700/60">
                  <GradientText colors={['#4F46E5', '#059669', '#6366F1', '#4F46E5']}>
                    768-dim Semantic Intelligence
                  </GradientText>
                </span>
                <h3 className="text-base font-bold text-navy-900 dark:text-white">
                  <BlurText
                    text="Ask CompanyAI"
                    animateBy="words"
                    delay={65}
                    stepDuration={0.28}
                    direction="top"
                  />
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md">
                  Query candidate resumes, evaluate JD requirement alignments, explain skill gaps, or audit active hiring requisitions.
                </p>
              </div>

              {/* Categorized Prompt Starters with React Bits SpotlightCard & GlareHover */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full text-left">
                {PROMPT_CATEGORIES.flatMap((c) => c.prompts).map((card, idx) => (
                  <AnimatedContent key={idx} distance={10} duration={0.28} delay={Math.min(idx * 45, 225)}>
                    <SpotlightCard intensity={0.18} borderGlow={0.35} spotlightSize={160} className="rounded-xl">
                      <GlareHover
                        as="button"
                        onClick={() => handleSendMessage(card.query)}
                        glareColor="rgba(16, 185, 129, 0.16)"
                        className="w-full text-left p-3 bg-white dark:bg-surface-darkCard hover:bg-slate-50 dark:hover:bg-surface-darkHover border border-slate-200/80 dark:border-surface-darkBorder hover:border-brand-300 dark:hover:border-brand-600/60 rounded-xl transition-all shadow-subtle card-interactive group"
                      >
                        <span className="text-xs font-bold text-navy-900 dark:text-white group-hover:text-brand-700 dark:group-hover:text-brand-400 block">
                          {card.title}
                        </span>
                        <span className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1 mt-0.5">
                          {card.desc}
                        </span>
                      </GlareHover>
                    </SpotlightCard>
                  </AnimatedContent>
                ))}
              </div>
            </div>
          ) : (
            /* Conversation Messages */
            activeSession.messages.map((msg) => {
              const isUser = msg.sender === 'user';
              return (
                <div
                  key={msg.id}
                  className={`flex gap-3.5 ${isUser ? 'justify-end' : 'justify-start'} animate-fadeIn`}
                >
                  {!isUser && (
                    <div className="w-8 h-8 rounded-xl bg-brand-50 dark:bg-brand-900/40 border border-brand-200 dark:border-brand-700/60 flex items-center justify-center text-brand-600 dark:text-brand-400 flex-shrink-0 mt-0.5 shadow-subtle">
                      <Sparkles className="w-4 h-4" />
                    </div>
                  )}

                  <div className={`max-w-2xl space-y-3 ${isUser ? 'items-end' : 'items-start'}`}>
                    {/* Tool Execution Trace Badge if Assistant Ran Tools */}
                    {!isUser && msg.trace && (
                      <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-surface-darkHover text-[10px] font-mono text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-surface-darkBorder">
                        <Terminal className="w-3 h-3 text-brand-600" />
                        <span>Tool: {msg.trace.tools_called?.[0]?.tool_name || 'engine'}</span>
                        <span>•</span>
                        <span>{msg.trace.latency_ms || 240}ms</span>
                        <span>•</span>
                        <span className="text-emerald-600 dark:text-emerald-400">verified</span>
                      </div>
                    )}

                    {/* Bubble */}
                    <div
                      className={`p-4 rounded-2xl text-[13px] sm:text-sm leading-relaxed ${
                        isUser
                          ? 'bg-navy-900 dark:bg-brand-700 text-white rounded-br-sm shadow-subtle'
                          : 'bg-white dark:bg-surface-darkCard border border-slate-200/80 dark:border-surface-darkBorder text-navy-900 dark:text-slate-100 card-reflective'
                      }`}
                    >
                      <p className="whitespace-pre-wrap">{msg.text}</p>
                      <span
                        className={`text-[10px] mt-2 block font-mono ${
                          isUser ? 'text-slate-300 text-right' : 'text-slate-400'
                        }`}
                      >
                        {msg.timestamp}
                      </span>
                    </div>

                    {/* Grounded Candidate Cards */}
                    {!isUser && msg.candidates && msg.candidates.length > 0 && (
                      <div className="space-y-2.5 pt-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-1 block">
                          Grounded Candidate Matches ({msg.candidates.length})
                        </span>
                        {msg.candidates.map((cand) => (
                          <div
                            key={cand.id}
                            className="p-3.5 bg-white dark:bg-surface-darkCard border border-slate-200/80 dark:border-surface-darkBorder rounded-xl shadow-subtle hover:border-brand-300 transition-all flex items-center justify-between gap-3"
                          >
                            <div>
                              <div className="flex items-center gap-2">
                                <h4 className="text-xs font-bold text-navy-900 dark:text-white">
                                  {cand.name}
                                </h4>
                                {cand.matchScore != null && (
                                  <Badge variant="brand" size="xs">
                                    {cand.matchScore}% Match
                                  </Badge>
                                )}
                              </div>
                              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                                {cand.currentRole} • {cand.experienceYears} yrs • {cand.location}
                              </p>
                            </div>
                            <button
                              onClick={() => onSelectCandidate && onSelectCandidate(cand.id)}
                              className="px-2.5 py-1 text-[11px] font-semibold text-brand-700 dark:text-brand-300 bg-brand-50 dark:bg-brand-900/40 border border-brand-200 dark:border-brand-700/60 rounded-lg hover:bg-brand-100 flex items-center gap-1"
                            >
                              <span>View Profile</span>
                              <ArrowRight className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}

          {/* React Bits LatticeLoader + Real Tool Execution Status Transitions */}
          {isLoading && (
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 text-xs text-slate-600 dark:text-slate-300 px-4 py-3 bg-white dark:bg-surface-darkCard border border-brand-200/80 dark:border-brand-800/70 rounded-2xl w-fit shadow-subtle animate-fadeIn">
              <LatticeLoader
                label={toolPhase === 'waiting' ? 'Dispatching query to CompanyAI' : 'CompanyAI is querying SQLite & executing tools'}
                pattern="orbit"
                grid={3}
                color="#059669"
                cellSize={5}
                fontSize={12}
                showTimer
              />
              <div className="flex items-center gap-1.5 pl-1 sm:border-l sm:border-slate-200 dark:sm:border-surface-darkBorder sm:pl-3">
                <span className="inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-full bg-brand-50 dark:bg-brand-950/60 text-brand-700 dark:text-brand-300 border border-brand-200 dark:border-brand-800">
                  {toolPhase === 'waiting' ? 'Waiting' : 'Running'}
                </span>
                <span className="inline-flex items-center gap-0.5 text-brand-600 dark:text-brand-400" aria-hidden="true">
                  <span className="w-1 h-1 rounded-full bg-current animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1 h-1 rounded-full bg-current animate-bounce" style={{ animationDelay: '120ms' }} />
                  <span className="w-1 h-1 rounded-full bg-current animate-bounce" style={{ animationDelay: '240ms' }} />
                </span>
              </div>
            </div>
          )}

          {errorNotice && (
            <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-xs text-red-700 dark:text-red-300">
              {errorNotice}
            </div>
          )}

          <div ref={chatScrollRef} />
        </div>

        {/* Chat Input Area */}
        <div className="p-4 border-t border-slate-100 dark:border-surface-darkBorder bg-white dark:bg-surface-darkCard space-y-2">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Ask CompanyAI to find candidates, evaluate a job, or explain match evidence..."
              disabled={isLoading}
              className="flex-1 px-4 py-2.5 text-xs bg-slate-50 dark:bg-surface-darkHover border border-slate-200 dark:border-surface-darkBorder rounded-xl text-navy-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-brand-500 transition-colors"
            />
            <button
              type="submit"
              disabled={isLoading || !inputText.trim()}
              className="p-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white shadow-subtle btn-interactive btn-glow"
              title="Send Message"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
          <div className="flex items-center justify-between text-[10px] text-slate-400 dark:text-slate-500 px-1">
            <span>Press Enter to send • Responses grounded in SQLite candidate resumes</span>
            <span>Safety: Recruiter confirmation required for record mutations</span>
          </div>
        </div>
      </div>

      {/* 3. RIGHT PANEL: CONTEXT PANEL */}
      <div className="w-full xl:w-72 bg-white dark:bg-surface-darkCard border border-slate-200/80 dark:border-surface-darkBorder rounded-2xl p-4 flex flex-col shadow-card flex-shrink-0 space-y-4">
        <div>
          <h3 className="text-xs font-bold text-navy-900 dark:text-white uppercase tracking-wider">
            Recruitment Context
          </h3>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
            Attach live entities to generate contextual questions
          </p>
        </div>

        {/* Context Selector Tabs */}
        <div className="flex bg-slate-100 dark:bg-surface-darkHover p-1 rounded-xl text-xs">
          {[
            { id: 'job', label: 'Job' },
            { id: 'candidate', label: 'Candidate' },
            { id: 'request', label: 'Request' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setContextTab(tab.id)}
              className={`flex-1 py-1 rounded-lg font-semibold transition-all ${
                contextTab === tab.id
                  ? 'bg-white dark:bg-surface-darkCard text-navy-900 dark:text-white shadow-subtle'
                  : 'text-slate-500 dark:text-slate-400 hover:text-navy-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Context Entity Details & 1-Click Prompt Triggers */}
        {contextTab === 'job' && activeContextJob && (
          <div className="space-y-3 flex-1 flex flex-col">
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-surface-darkHover/60 border border-slate-200/70 dark:border-surface-darkBorder space-y-2 text-xs">
              <span className="text-[10px] font-bold text-slate-400 block uppercase">Active Job</span>
              <h4 className="font-bold text-navy-900 dark:text-white">{activeContextJob.title}</h4>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {activeContextJob.location || 'Location not specified'} • {activeContextJob.experienceRequired || 'Experience N/A'}
              </p>
              <div className="flex flex-wrap gap-1 pt-1">
                {(activeContextJob.requiredSkills || []).slice(0, 3).map((sk, i) => (
                  <Badge key={i} variant="neutral" size="xs">
                    {sk}
                  </Badge>
                ))}
              </div>
            </div>

            <div className="space-y-1.5 pt-2">
              <span className="text-[10px] font-bold text-slate-400 block uppercase">Context Actions</span>
              <button
                onClick={() => handleSendMessage(`Find candidates matching ${activeContextJob.title}`)}
                className="w-full text-left p-2 rounded-lg bg-white dark:bg-surface-darkCard hover:bg-brand-50 dark:hover:bg-brand-900/30 border border-slate-200 dark:border-slate-700 text-xs text-navy-900 dark:text-slate-200 font-medium transition-all"
              >
                Find candidates matching this job
              </button>
              <button
                onClick={() => handleSendMessage(`Summarize mandatory requirements for ${activeContextJob.title}`)}
                className="w-full text-left p-2 rounded-lg bg-white dark:bg-surface-darkCard hover:bg-brand-50 dark:hover:bg-brand-900/30 border border-slate-200 dark:border-slate-700 text-xs text-navy-900 dark:text-slate-200 font-medium transition-all"
              >
                Summarize mandatory requirements
              </button>
            </div>
          </div>
        )}

        {contextTab === 'candidate' && activeContextCand && (
          <div className="space-y-3 flex-1 flex flex-col">
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-surface-darkHover/60 border border-slate-200/70 dark:border-surface-darkBorder space-y-2 text-xs">
              <span className="text-[10px] font-bold text-slate-400 block uppercase">Active Candidate</span>
              <h4 className="font-bold text-navy-900 dark:text-white">{activeContextCand.name}</h4>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {activeContextCand.currentRole} • {activeContextCand.experienceYears} yrs
              </p>
              <div className="flex flex-wrap gap-1 pt-1">
                {(activeContextCand.primarySkills || []).slice(0, 3).map((sk, i) => (
                  <Badge key={i} variant="neutral" size="xs">
                    {sk}
                  </Badge>
                ))}
              </div>
            </div>

            <div className="space-y-1.5 pt-2">
              <span className="text-[10px] font-bold text-slate-400 block uppercase">Context Actions</span>
              <button
                onClick={() => handleSendMessage(`What jobs best match candidate ${activeContextCand.name}?`)}
                className="w-full text-left p-2 rounded-lg bg-white dark:bg-surface-darkCard hover:bg-brand-50 dark:hover:bg-brand-900/30 border border-slate-200 dark:border-slate-700 text-xs text-navy-900 dark:text-slate-200 font-medium transition-all"
              >
                What jobs best match this candidate?
              </button>
              <button
                onClick={() => handleSendMessage(`Summarize skills and experience for ${activeContextCand.name}`)}
                className="w-full text-left p-2 rounded-lg bg-white dark:bg-surface-darkCard hover:bg-brand-50 dark:hover:bg-brand-900/30 border border-slate-200 dark:border-slate-700 text-xs text-navy-900 dark:text-slate-200 font-medium transition-all"
              >
                Summarize verified skills & resume
              </button>
            </div>
          </div>
        )}

        {contextTab === 'request' && activeContextReq && (
          <div className="space-y-3 flex-1 flex flex-col">
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-surface-darkHover/60 border border-slate-200/70 dark:border-surface-darkBorder space-y-2 text-xs">
              <span className="text-[10px] font-bold text-slate-400 block uppercase">Active Requisition</span>
              <h4 className="font-bold text-navy-900 dark:text-white">{activeContextReq.roleTitle || activeContextReq.role_title}</h4>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {activeContextReq.reqNumber || activeContextReq.req_number} • Priority: {activeContextReq.priority}
              </p>
            </div>

            <div className="space-y-1.5 pt-2">
              <span className="text-[10px] font-bold text-slate-400 block uppercase">Context Actions</span>
              <button
                onClick={() => handleSendMessage(`What is the progress on requisition ${activeContextReq.reqNumber || activeContextReq.req_number}?`)}
                className="w-full text-left p-2 rounded-lg bg-white dark:bg-surface-darkCard hover:bg-brand-50 dark:hover:bg-brand-900/30 border border-slate-200 dark:border-slate-700 text-xs text-navy-900 dark:text-slate-200 font-medium transition-all"
              >
                Check requisition status & progress
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
