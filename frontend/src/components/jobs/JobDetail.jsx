// Import React for JSX structure and local approval notice state.
import React, { useState, useMemo, useEffect, useRef } from 'react';

// Import Badge and CustomSelect components for skills, status pills, and beautified dropdowns.
import { Badge } from '../common/Badge';
import { CustomSelect } from '../common/CustomSelect';

// Import AI Intelligence panel for hiring difficulty, supply/demand & sourcing recommendations.
import { AIIntelligencePanel } from './AIIntelligencePanel';
// Import the dedicated approved-JD posting and distribution workspace.
import { JobPostingWorkspace } from './JobPostingWorkspace';

// Import MatchingCandidates subcomponent.
import { MatchingCandidates } from './MatchingCandidates';
import { InterviewKitWorkspace } from './InterviewKitWorkspace';
import { MarketReportModal } from './MarketReportModal';

// Import approvalApi & intelligence APIs for JD approval & AI insights.
import { approvalApi, intelligenceApi, aiApi, jobApi } from '../../api/client';

// Import icons from lucide-react.
import {
  Briefcase,
  MapPin,
  Sparkles,
  FileText,
  CheckCircle,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  Users,
  ChevronDown,
  ChevronUp,
  Building2,
  Building,
  Crown,
  Globe,
  Target,
  Ban,
  Search,
  Copy,
  Check,
  Plus,
  X,
  ExternalLink,
  Zap,
  Edit3,
  RotateCcw,
  SlidersHorizontal,
  ShieldAlert,
  GitMerge,
  GitCompare,
  Layers,
  Tag,
  ArrowUpRight,
  Info,
  HelpCircle,
  Maximize2,
  Minimize2,
  Database,
  Send,
  FileBarChart2,
  Save,
  Loader2,
  Download,
} from 'lucide-react';

// Sourcing Company Categories with visual styles and icons
export const COMPANY_CATEGORIES = [
  { id: 'all', label: 'All Companies', icon: Building2 },
  { id: 'agency', label: 'Advertising & Creative Studios', icon: Sparkles, color: 'text-pink-700 dark:text-pink-300 bg-pink-50 dark:bg-pink-950/60 border-pink-200/80 dark:border-pink-800' },
  { id: 'retail', label: 'Retail & E-Commerce Hubs', icon: Target, color: 'text-cyan-700 dark:text-cyan-300 bg-cyan-50 dark:bg-cyan-950/60 border-cyan-200/80 dark:border-cyan-800' },
  { id: 'oem', label: 'Product & OEMs', icon: Crown, color: 'text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200/80 dark:border-emerald-800' },
  { id: 'big4', label: 'Big 4 & Advisory', icon: Building, color: 'text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 border-blue-200/80 dark:border-blue-800' },
  { id: 'gsi', label: 'Global System Integrators', icon: Globe, color: 'text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/60 border-purple-200/80 dark:border-purple-800' },
  { id: 'gcc', label: 'Enterprise GCCs & Hubs', icon: Target, color: 'text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 border-amber-200/80 dark:border-amber-800' },
];

// Talent Sourcing Strategies with descriptive positioning for recruiter dropdown
export const SOURCING_STRATEGIES = [
  { id: 'tier1', label: 'Tier-1 Competitors & Parallel Ecosystems', desc: 'Product OEMs, Big 4 Advisory, GSIs & Tech GCCs', catFilter: 'all' },
  { id: 'oem', label: 'Product OEMs & Platform Specialists', desc: 'Direct software vendors and platform engineering centers', catFilter: 'oem' },
  { id: 'big4', label: 'Big 4 & Strategic Advisory Firms', desc: 'Consulting practices with enterprise implementation arms', catFilter: 'big4' },
  { id: 'gsi', label: 'Global System Integrators (GSIs)', desc: 'Tier-1 technology delivery partners and systems integrators', catFilter: 'gsi' },
  { id: 'gcc', label: 'Enterprise GCCs & Tech Hubs', desc: 'Internal engineering centers and captive business services', catFilter: 'gcc' },
];

// Rich, structured ecosystem intelligence for recruiter talent sourcing across all core domains.
const STACK_COMPANY_ECOSYSTEMS = [
  // 1. ServiceNow FSO / Financial Services Operations / Complaint Management / CSM / ITSM
  {
    keywords: ['servicenow', 'fso', 'complaint', 'financial services operations', 'itsm', 'csm', 'flow designer', 'snow', 'dispute'],
    ecosystemName: 'ServiceNow Financial Services Operations (FSO) & Workflows',
    companies: [
      { name: 'ServiceNow', category: 'oem', tier: 'Platform OEM IDC', location: 'Hyderabad / Bangalore', description: 'Core product engineering, FSO platform & CSM development' },
      { name: 'Deloitte', category: 'big4', tier: 'Global Elite Partner', location: 'Hyderabad / Bangalore / Mumbai', description: 'Tier-1 ServiceNow practice, large-scale FSO & banking transformation' },
      { name: 'PwC', category: 'big4', tier: 'Global Elite Partner', location: 'Bangalore / Hyderabad / Kolkata', description: 'Financial services regulatory workflow & complaint management' },
      { name: 'EY', category: 'big4', tier: 'Global Elite Partner', location: 'Bangalore / Gurgaon / Mumbai', description: 'Risk, compliance, and ServiceNow FSO digital workflows' },
      { name: 'KPMG', category: 'big4', tier: 'Elite Solution Partner', location: 'Bangalore / Mumbai / Pune', description: 'Banking workflow automation & dispute resolution practice' },
      { name: 'Cognizant', category: 'gsi', tier: 'Global Elite Partner', location: 'Chennai / Hyderabad / Bangalore', description: 'Dedicated ServiceNow CoE with 4,000+ certified practitioners' },
      { name: 'Accenture', category: 'gsi', tier: 'Global Elite Leader', location: 'Bangalore / Hyderabad / Pune', description: 'Enterprise ServiceNow delivery & banking sector solutions' },
      { name: 'Infosys', category: 'gsi', tier: 'Global Elite Partner', location: 'Bangalore / Hyderabad / Pune', description: 'Infosys Cobalt ServiceNow business unit & financial services' },
      { name: 'LTIMindtree', category: 'gsi', tier: 'Elite Partner', location: 'Bangalore / Mumbai / Pune', description: 'FSO and enterprise service management center of excellence' },
      { name: 'Wipro', category: 'gsi', tier: 'Global Elite Partner', location: 'Bangalore / Hyderabad', description: 'Financial services workflow modernization & CSM implementation' },
      { name: 'Barclays', category: 'gcc', tier: 'Banking GCC CoE', location: 'Pune / Mumbai', description: 'Internal ServiceNow FSO & customer complaint management hub' },
      { name: 'Standard Chartered GBS', category: 'gcc', tier: 'Global Banking GCC', location: 'Bangalore / Chennai', description: 'Banking operations workflow & case management platforms' },
      { name: 'HSBC Technology India', category: 'gcc', tier: 'Global Tech Center', location: 'Hyderabad / Pune', description: 'Enterprise servicing, complaint tracking & dispute engineering' },
      { name: 'Wells Fargo India', category: 'gcc', tier: 'Banking GCC', location: 'Hyderabad / Bangalore', description: 'Core financial workflow engineering & regulatory compliance systems' },
    ],
  },

  // 2. Oracle EPM / Hyperion / FCCS / Financial Consolidation / Smart View / Essbase
  {
    keywords: ['oracle', 'epm', 'hyperion', 'fccs', 'financial consolidation', 'essbase', 'smart view', 'pbcs', 'hfm'],
    ecosystemName: 'Oracle EPM, FCCS & Financial Consolidation',
    companies: [
      { name: 'Oracle', category: 'oem', tier: 'Software OEM IDC', location: 'Bangalore / Hyderabad', description: 'Core Oracle EPM, FCCS Cloud & Essbase product engineering' },
      { name: 'Deloitte', category: 'big4', tier: 'Global EPM Leader', location: 'Hyderabad / Bangalore / Mumbai', description: 'Leading Oracle EPM & financial consolidation transformation practice' },
      { name: 'PwC', category: 'big4', tier: 'Global Advisory', location: 'Bangalore / Hyderabad / Kolkata', description: 'Finance close, regulatory consolidation & FCCS implementation' },
      { name: 'EY', category: 'big4', tier: 'Advisory Leader', location: 'Bangalore / Gurgaon / Mumbai', description: 'Financial performance management, FCCS & statutory reporting' },
      { name: 'KPMG', category: 'big4', tier: 'EPM Advisory Partner', location: 'Bangalore / Mumbai / Gurgaon', description: 'Enterprise planning, budgeting & financial close practice' },
      { name: 'Accenture', category: 'gsi', tier: 'Global Platinum Partner', location: 'Bangalore / Hyderabad / Pune', description: 'Largest Oracle Cloud EPM delivery practice in India' },
      { name: 'Genpact', category: 'gsi', tier: 'Record-to-Report Specialist', location: 'Hyderabad / Gurgaon / Bangalore', description: 'Finance & accounting operations with deep Hyperion/EPM CoE' },
      { name: 'Cognizant', category: 'gsi', tier: 'Global Delivery Partner', location: 'Chennai / Hyderabad / Bangalore', description: 'Oracle Financial Solutions practice with certified FCCS experts' },
      { name: 'Wipro', category: 'gsi', tier: 'Oracle Cloud Partner', location: 'Bangalore / Hyderabad', description: 'Enterprise EPM transformation & managed support practice' },
      { name: 'Infosys', category: 'gsi', tier: 'Oracle Practice Group', location: 'Bangalore / Hyderabad / Pune', description: 'Global Oracle financial close and consolidation services' },
      { name: 'American Express', category: 'gcc', tier: 'Global Financial GCC', location: 'Gurgaon / Bangalore', description: 'Enterprise financial planning & Hyperion analytics center' },
      { name: 'Goldman Sachs', category: 'gcc', tier: 'Investment Banking Tech', location: 'Bangalore / Hyderabad', description: 'P&L consolidation, ledger reporting & regulatory systems' },
      { name: 'Bank of America', category: 'gcc', tier: 'Banking GCC', location: 'Hyderabad / Mumbai / Chennai', description: 'Finance tech division managing global consolidations' },
    ],
  },

  // 3. VLSI / FPGA / Verification / DO-254 / Avionics / SystemVerilog / UVM
  {
    keywords: ['vlsi', 'fpga', 'do-254', 'systemverilog', 'uvm', 'verification', 'asic', 'avionics', 'rtl', 'soc', 'soc verification'],
    ecosystemName: 'Semiconductor VLSI, FPGA & DO-254 Avionics',
    companies: [
      { name: 'Cadence Design Systems', category: 'oem', tier: 'EDA Tool OEM', location: 'Noida / Bangalore / Pune', description: 'Verification IP, simulation tools & formal verification R&D' },
      { name: 'Synopsys', category: 'oem', tier: 'EDA & IP OEM', location: 'Bangalore / Hyderabad / Noida', description: 'UVM verification methodology, VIP development & emulation tools' },
      { name: 'AMD', category: 'oem', tier: 'Semiconductor OEM', location: 'Hyderabad / Bangalore', description: 'FPGA design, adaptive SoCs & silicon verification engineering' },
      { name: 'Intel', category: 'oem', tier: 'Semiconductor OEM', location: 'Bangalore', description: 'FPGA architecture, Quartus Prime & complex SoC verification' },
      { name: 'Qualcomm', category: 'oem', tier: 'Silicon OEM Hub', location: 'Hyderabad / Bangalore / Chennai', description: 'Advanced SystemVerilog/UVM SoC verification engineering' },
      { name: 'eInfochips (Arrow)', category: 'gsi', tier: 'DO-254 Specialist', location: 'Ahmedabad / Bangalore / Pune', description: 'Dedicated aerospace DO-254 hardware & FPGA verification lab' },
      { name: 'Tata Elxsi', category: 'gsi', tier: 'Aerospace Systems Partner', location: 'Bangalore / Trivandrum', description: 'Avionics DO-254 certification & safety-critical FPGA designs' },
      { name: 'Wipro', category: 'gsi', tier: 'VLSI Design Services', location: 'Bangalore / Hyderabad', description: 'Semiconductor engineering practice with 2,500+ VLSI engineers' },
      { name: 'HCLTech', category: 'gsi', tier: 'ER&D Silicon Practice', location: 'Bangalore / Noida / Chennai', description: 'ASIC/FPGA verification & DO-254 aerospace compliance' },
      { name: 'Cyient', category: 'gsi', tier: 'Aerospace Engineering', location: 'Hyderabad / Bangalore', description: 'Avionics hardware design, verification & FAA/EASA certification' },
      { name: 'Honeywell Aerospace', category: 'gcc', tier: 'Avionics OEM Center', location: 'Bangalore / Hyderabad', description: 'Flight-critical DO-254 hardware, avionics boxes & FPGA R&D' },
      { name: 'Collins Aerospace (RTX)', category: 'gcc', tier: 'Flight Systems Center', location: 'Bangalore / Hyderabad', description: 'Safety-critical DO-254 FPGA verification & flight management' },
      { name: 'Texas Instruments', category: 'gcc', tier: 'Semiconductor R&D', location: 'Bangalore', description: 'Analog, mixed-signal & embedded processors verification' },
      { name: 'GE Aerospace India', category: 'gcc', tier: 'Aviation Tech Center', location: 'Bangalore', description: 'Engine controls, FADEC hardware & DO-254 compliant verification' },
    ],
  },

  // 4. Siemens Teamcenter / PLM / BMIDE / Active Workspace
  {
    keywords: ['teamcenter', 'bmide', 'plm', 'active workspace', 'siemens', 'itk', 'awc'],
    ecosystemName: 'Siemens Teamcenter & Digital PLM Engineering',
    companies: [
      { name: 'Siemens Digital Industries', category: 'oem', tier: 'Software OEM IDC', location: 'Pune / Bangalore', description: 'Core Teamcenter product engineering, BMIDE and Active Workspace R&D' },
      { name: 'PwC', category: 'big4', tier: 'Digital Operations', location: 'Bangalore / Hyderabad / Mumbai', description: 'Smart manufacturing, PLM digital thread and industry 4.0 consulting' },
      { name: 'Deloitte', category: 'big4', tier: 'PLM Advisory', location: 'Bangalore / Hyderabad / Pune', description: 'Enterprise PLM roadmap, Teamcenter architecture and business change' },
      { name: 'Tata Technologies', category: 'gsi', tier: 'Premier PLM Integrator', location: 'Pune / Bangalore', description: 'Largest dedicated Teamcenter engineering practice in India' },
      { name: 'L&T Technology Services', category: 'gsi', tier: 'ER&D Leader', location: 'Bangalore / Mumbai / Vadodara', description: 'Full-lifecycle Teamcenter customization, ITK, BMIDE & data migration' },
      { name: 'Capgemini', category: 'gsi', tier: 'Digital Engineering', location: 'Bangalore / Mumbai / Pune', description: 'Global PLM center of excellence for aerospace & automotive clients' },
      { name: 'HCLTech', category: 'gsi', tier: 'Engineering Services', location: 'Noida / Bangalore / Chennai', description: 'Teamcenter AWC modernization & CAD/ERP enterprise integrations' },
      { name: 'Quest Global', category: 'gsi', tier: 'Aerospace & Auto PLM', location: 'Bangalore / Trivandrum', description: 'Product lifecycle management engineering for Fortune 500 OEMs' },
      { name: 'Mercedes-Benz R&D India', category: 'gcc', tier: 'Automotive GCC', location: 'Bangalore', description: 'Global digital vehicle engineering & Teamcenter PLM backbone' },
      { name: 'Boeing India', category: 'gcc', tier: 'Aerospace Engineering', location: 'Bangalore / Chennai', description: 'Commercial & defense aircraft Teamcenter PLM digital thread' },
      { name: 'Airbus India', category: 'gcc', tier: 'Aerospace Tech Hub', location: 'Bangalore', description: 'PLM design engineering & configuration management platforms' },
      { name: 'Bosch Global Software', category: 'gcc', tier: 'Industrial Tech Hub', location: 'Bangalore / Coimbatore', description: 'Enterprise engineering data management & PLM solutions' },
    ],
  },

  // 5. Cloud Infrastructure / AWS / Azure / GCP / DevOps / Kubernetes / Terraform / SRE
  {
    keywords: ['cloud infrastructure', 'devops', 'kubernetes', 'terraform', 'aws', 'azure', 'gcp', 'sre', 'site reliability', 'docker', 'ansible', 'helm'],
    ecosystemName: 'Cloud Infrastructure, Platform & SRE Engineering',
    companies: [
      { name: 'Amazon Web Services (AWS)', category: 'oem', tier: 'Hyperscaler OEM', location: 'Bangalore / Hyderabad', description: 'Hyperscale cloud architecture, container platforms & core services' },
      { name: 'Microsoft Azure', category: 'oem', tier: 'Cloud OEM IDC', location: 'Hyderabad / Bangalore', description: 'Azure core compute, Kubernetes service (AKS) & infrastructure engineering' },
      { name: 'Google Cloud (GCP)', category: 'oem', tier: 'Hyperscaler OEM', location: 'Bangalore / Hyderabad', description: 'Google Cloud Platform infra, Anthos, Kubernetes & network engineering' },
      { name: 'Deloitte', category: 'big4', tier: 'Cloud Transformation', location: 'Hyderabad / Bangalore / Mumbai', description: 'Enterprise multi-cloud architecture, DevOps governance & SRE practice' },
      { name: 'PwC', category: 'big4', tier: 'Cloud & Digital', location: 'Bangalore / Hyderabad / Kolkata', description: 'Infrastructure modernization, cloud security & resilience advisory' },
      { name: 'EY', category: 'big4', tier: 'Cloud Advisory', location: 'Bangalore / Gurgaon / Mumbai', description: 'Enterprise cloud migration, IaC automation & FinOps practice' },
      { name: 'Accenture', category: 'gsi', tier: 'Cloud First Practice', location: 'Bangalore / Hyderabad / Pune', description: 'Largest multi-cloud delivery and DevOps automation practice' },
      { name: 'Infosys', category: 'gsi', tier: 'Cobalt Cloud Practice', location: 'Bangalore / Hyderabad / Pune', description: 'Enterprise cloud platform engineering & automated infrastructure' },
      { name: 'TCS', category: 'gsi', tier: 'Enterprise Cloud Unit', location: 'Chennai / Hyderabad / Bangalore', description: 'Global SRE, hybrid-cloud operations & container management' },
      { name: 'LTIMindtree', category: 'gsi', tier: 'Cloud Infrastructure BU', location: 'Bangalore / Mumbai / Pune', description: 'Kubernetes orchestration, Terraform automation & SRE delivery' },
      { name: 'Walmart Global Tech', category: 'gcc', tier: 'Retail Cloud Hub', location: 'Bangalore / Chennai', description: 'Internal multi-cloud platform, large-scale Kubernetes & SRE division' },
      { name: 'Target India', category: 'gcc', tier: 'Enterprise GCC', location: 'Bangalore', description: 'Cloud infrastructure engineering, automation pipelines & platform reliability' },
      { name: 'PayPal India', category: 'gcc', tier: 'Fintech Platform Hub', location: 'Chennai / Bangalore', description: 'High-availability infrastructure, edge computing & platform reliability' },
      { name: 'JPMorgan Chase', category: 'gcc', tier: 'Banking Platform Hub', location: 'Bangalore / Hyderabad', description: 'Global cloud platform services, internal Kubernetes & resilience engineering' },
    ],
  },

  // 6. SAP CPI / Integration Suite / S/4HANA / ABAP / PS / Security GRC
  {
    keywords: ['sap', 'cpi', 'integration suite', 's/4hana', 'abap', 'sap ps', 'sap security', 'grc', 'pi/po', 'idoc', 'bapi'],
    ecosystemName: 'SAP CPI, Integration Suite & S/4HANA Ecosystem',
    companies: [
      { name: 'SAP Labs India', category: 'oem', tier: 'Software OEM Lab', location: 'Bangalore / Pune / Gurgaon', description: 'Core SAP Integration Suite, CPI connectors & S/4HANA product engineering' },
      { name: 'Deloitte', category: 'big4', tier: 'Global SAP Leader', location: 'Hyderabad / Bangalore / Mumbai', description: 'Diamond SAP partner, enterprise CPI integration & S/4HANA transformations' },
      { name: 'PwC', category: 'big4', tier: 'SAP Advisory', location: 'Bangalore / Hyderabad / Mumbai', description: 'Enterprise SAP architecture, CPI middleware & GRC security controls' },
      { name: 'EY', category: 'big4', tier: 'SAP Advisory Leader', location: 'Bangalore / Gurgaon / Mumbai', description: 'SAP Security, GRC Access Control, SoD matrices & CPI integrations' },
      { name: 'KPMG', category: 'big4', tier: 'SAP Systems & Controls', location: 'Bangalore / Mumbai / Pune', description: 'SAP GRC security audit, authorization design & integration risk' },
      { name: 'Accenture', category: 'gsi', tier: 'SAP Innovation Center', location: 'Bangalore / Hyderabad / Pune', description: 'Global leader in SAP Cloud Platform Integration (CPI) implementations' },
      { name: 'Infosys', category: 'gsi', tier: 'Enterprise SAP BU', location: 'Bangalore / Hyderabad / Pune', description: 'SAP Integration Suite Center of Excellence & migration services' },
      { name: 'Capgemini', category: 'gsi', tier: 'SAP Global Partner', location: 'Bangalore / Mumbai / Kolkata', description: 'Enterprise SAP BTP, CPI integration & hybrid-landscape architectures' },
      { name: 'Wipro', category: 'gsi', tier: 'SAP Practice Group', location: 'Bangalore / Hyderabad', description: 'SAP S/4HANA migration, middleware integration & cloud BTP' },
      { name: 'TCS', category: 'gsi', tier: 'SAP Delivery Practice', location: 'Chennai / Hyderabad / Bangalore', description: 'End-to-end SAP integration services, IDoc/BAPI interfaces & CPI' },
      { name: 'Siemens Healthineers', category: 'gcc', tier: 'Healthcare Tech GCC', location: 'Bangalore', description: 'Internal global SAP S/4HANA landscape & enterprise CPI pipelines' },
      { name: 'Shell India', category: 'gcc', tier: 'Energy Tech Center', location: 'Bangalore / Chennai', description: 'Complex SAP enterprise architecture, supply chain & CPI integration' },
      { name: 'Bayer Technology', category: 'gcc', tier: 'Life Sciences GCC', location: 'Bangalore / Hyderabad', description: 'Global SAP integration, GRC security & digital supply chain platforms' },
    ],
  },

  // 7. Java / Spring Boot / Production Support / Microservices / Kafka
  {
    keywords: ['java', 'spring', 'microservices', 'production support', 'application support', 'hibernate', 'kafka', 'incident management', 'l2/l3', 'production engineer'],
    ecosystemName: 'Java Enterprise, Microservices & Production Support',
    companies: [
      { name: 'Oracle', category: 'oem', tier: 'Technology OEM', location: 'Bangalore / Hyderabad', description: 'Core Java engineering, JVM optimization & enterprise cloud services' },
      { name: 'Red Hat', category: 'oem', tier: 'Enterprise Open Source', location: 'Pune / Bangalore', description: 'Quarkus, Spring runtime, OpenShift & enterprise Java middleware' },
      { name: 'Deloitte', category: 'big4', tier: 'Technology Consulting', location: 'Hyderabad / Bangalore / Mumbai', description: 'Core banking backend systems, Java microservices modernization' },
      { name: 'PwC', category: 'big4', tier: 'Digital & Apps Practice', location: 'Bangalore / Hyderabad / Kolkata', description: 'Enterprise Java architecture & high-reliability financial systems' },
      { name: 'TCS', category: 'gsi', tier: 'Banking IT Leader', location: 'Chennai / Hyderabad / Bangalore', description: '24x7 mission-critical application support for top global investment banks' },
      { name: 'Infosys', category: 'gsi', tier: 'Core Banking & Apps', location: 'Bangalore / Hyderabad / Pune', description: 'Large-scale Java production support, incident resolution & L2/L3 services' },
      { name: 'Cognizant', category: 'gsi', tier: 'Global Production Ops', location: 'Chennai / Hyderabad / Bangalore', description: 'Application support & maintenance (ASM) practice with deep Java expertise' },
      { name: 'Persistent Systems', category: 'gsi', tier: 'Digital Engineering', location: 'Pune / Bangalore / Hyderabad', description: 'Cloud-native Java development, API integrations & platform support' },
      { name: 'EPAM Systems', category: 'gsi', tier: 'Software Engineering', location: 'Hyderabad / Bangalore / Pune', description: 'High-performance Java backend engineering & distributed systems' },
      { name: 'Virtusa', category: 'gsi', tier: 'Fintech Engineering', location: 'Hyderabad / Chennai / Bangalore', description: 'Banking production operations, payment gateways & Java support' },
      { name: 'Morgan Stanley', category: 'gcc', tier: 'Investment Banking GCC', location: 'Mumbai / Bangalore', description: 'Low-latency trading platforms, Java microservices & SRE support' },
      { name: 'Deutsche Bank (DWS)', category: 'gcc', tier: 'Corporate Bank Tech', location: 'Pune / Bangalore', description: 'Transaction banking, payments backbones & Java production engineering' },
      { name: 'Bank of America', category: 'gcc', tier: 'Global Tech Center', location: 'Hyderabad / Mumbai / Chennai', description: 'Wholesale payments & wealth management Java production operations' },
      { name: 'Societe Generale GSC', category: 'gcc', tier: 'Capital Markets GCC', location: 'Bangalore / Chennai', description: 'Derivatives trading IT, risk computing & Java application support' },
    ],
  },

  // 8. Retail Item & Product Data Operations / Merchandising / Catalog Operations
  {
    keywords: ['item setup', 'item launches', 'product data', 'item data', 'data quality', 'data remediation', 'merchant', 'retail operations', 'merchandising', 'catalog operations', 'item coe', 'sku'],
    ecosystemName: 'Retail & Merchandising Product Data Operations',
    companies: [
      { name: 'Target in India', category: 'gcc', tier: 'Global Retail GCC Leader', location: 'Bangalore', description: 'Core merchandising operations, item setup CoE, data quality & Minneapolis coordination' },
      { name: 'Walmart Global Tech', category: 'gcc', tier: 'Global Retail GCC', location: 'Bangalore / Chennai', description: 'Item data management, catalog quality, and supplier integration operations' },
      { name: 'Amazon India', category: 'gcc', tier: 'E-Commerce Tech & Ops', location: 'Bangalore / Hyderabad / Chennai', description: 'Catalog operations, item launches, vendor management & retail catalog quality' },
      { name: 'Tesco Bengaluru (HSC)', category: 'gcc', tier: 'Retail GCC Hub', location: 'Bangalore', description: 'Commercial product data, merchandising support & supplier coordination' },
      { name: 'Lowe\'s India', category: 'gcc', tier: 'Home Improvement Retail GCC', location: 'Bangalore', description: 'Product data management, pricing, catalog setup & vendor onboarding' },
      { name: 'Wayfair India', category: 'gcc', tier: 'E-Commerce Retail Hub', location: 'Bangalore', description: 'Catalog data operations, supplier coordination & product launch management' },
      { name: 'Genpact', category: 'gsi', tier: 'Retail Operations BPO', location: 'Bangalore / Gurgaon / Hyderabad', description: 'Retail merchandising operations, item master data & vendor support' },
      { name: 'WNS Global Services', category: 'gsi', tier: 'Retail & Consumer BPO', location: 'Pune / Mumbai / Bangalore', description: 'Product data management, digital cataloging & merchandising workflows' },
      { name: 'Infosys BPM', category: 'gsi', tier: 'Retail Services Unit', location: 'Bangalore / Pune / Hyderabad', description: 'Item setup, vendor operations & master data governance' },
      { name: 'Accenture Operations', category: 'gsi', tier: 'Global Operations Leader', location: 'Bangalore / Mumbai / Gurgaon', description: 'Supply chain & merchandising operations support' },
    ],
  },
  // 9. Creative, Advertising, Graphic Design & Media Production Ecosystem
  {
    keywords: ['art director', 'creative director', 'graphic design', 'advertising design', 'creative operations', 'media production', 'storyboarding', 'typography', 'adobe illustrator', 'photoshop', 'after effects', 'cinema 4d', 'autodesk maya', 'creative_design', 'in-store marketing', 'ism', 'brand storytelling'],
    ecosystemName: 'Creative, Advertising, Graphic Design & Media Production',
    companies: [
      { name: 'Target in India', category: 'gcc', tier: 'Global Retail Creative CoE', location: 'Bangalore', description: 'In-store marketing (ISM), packaging, digital media design & creative operations CoE' },
      { name: 'Ogilvy India (WPP)', category: 'agency', tier: 'Global Advertising Agency', location: 'Bangalore / Mumbai / Gurgaon', description: 'Creative direction, brand campaigns, advertising design & media execution' },
      { name: 'Leo Burnett (Publicis)', category: 'agency', tier: 'Creative Agency Network', location: 'Bangalore / Mumbai / Gurgaon', description: 'Art direction, visual storytelling, multimedia design & brand campaigns' },
      { name: 'WPP India', category: 'agency', tier: 'Global Media & Advertising Network', location: 'Bangalore / Mumbai / Delhi', description: 'Integrated advertising, packaging, digital production & multi-channel media' },
      { name: 'Publicis Sapient', category: 'agency', tier: 'Digital Creative Experience', location: 'Bangalore / Gurgaon / Noida', description: 'Digital experience design, art direction, and omnichannel creative production' },
      { name: 'Dentsu Creative', category: 'agency', tier: 'Global Creative Network', location: 'Bangalore / Mumbai / Gurgaon', description: 'Brand advertising, entertainment media, 3D motion & visual communication' },
      { name: 'McCann Worldgroup', category: 'agency', tier: 'Global Creative Agency', location: 'Bangalore / Mumbai / Delhi', description: 'Integrated brand campaigns, art direction, packaging & advertising design' },
      { name: 'Schbang', category: 'agency', tier: 'Integrated Creative & Digital Studio', location: 'Bangalore / Mumbai / Delhi', description: 'End-to-end creative production, graphic design, 3D motion & brand marketing' },
      { name: 'Lowe Lintas (MullenLowe)', category: 'agency', tier: 'Brand Strategy & Creative', location: 'Bangalore / Mumbai / Delhi', description: 'Iconic consumer brand campaigns, art direction & creative leadership' },
      { name: 'Amazon Advertising', category: 'gcc', tier: 'Creative & Media Production Hub', location: 'Bangalore / Chennai', description: 'Global ad creatives, brand storytelling, video production & motion design' },
    ],
  },
  // 10. CAD, BIM, Digital Engineering & Architectural Systems
  {
    keywords: ['cad', 'autocad', 'microstation', 'revit', 'bim', 'bim 360', 'bluebeam', 'drafting', 'building engineered systems', 'architectural', 'store planning', 'remodel', 'digital engineering'],
    ecosystemName: 'CAD, BIM, Digital Engineering & Architectural Systems',
    companies: [
      // Tier 1: Software OEMs & Dedicated Retail Hubs
      { name: 'Autodesk India', category: 'oem', tier_level: 'Tier 1', tier: 'Tier-1 Design & CAD Software OEM', location: 'Bangalore', description: 'Platform creator of AutoCAD, Revit, and BIM 360 cloud collaboration', overlap_skills: ['AutoCAD', 'Autodesk Revit', 'BIM 360', 'Navisworks'], why_recommended: 'Platform creators with authoritative architectural modeling proficiency; primary source for lead CAD/BIM standards drafters.' },
      { name: 'Bentley Systems', category: 'oem', tier_level: 'Tier 1', tier: 'Tier-1 Infrastructure Engineering OEM', location: 'Pune / Kolkata / Chennai', description: 'Core engineering and development center for MicroStation and ProjectWise', overlap_skills: ['MicroStation', 'ProjectWise', 'OpenBuildings', 'Plant CAD'], why_recommended: 'Direct creator of MicroStation; deepest talent pool for infrastructure drafting and precision digital building models.' },
      { name: 'Trimble India', category: 'oem', tier_level: 'Tier 1', tier: 'Tier-1 BIM & Geospatial Tech OEM', location: 'Chennai / Pune', description: 'Building construction modeling, Tekla Structures, and BIM software engineering', overlap_skills: ['Tekla Structures', 'Trimble Connect', 'BIM Modeling', 'Revit Interoperability'], why_recommended: 'World-class building construction modeling and 3D detailing engineers with hands-on BIM implementation.' },
      { name: 'Target India (Target GCC)', category: 'gcc', tier_level: 'Tier 1', tier: 'Tier-1 Retail Space & Remodel Hub', location: 'Bangalore', description: 'Direct in-house retail asset protection, store remodel documentation, and BIM facility planning', overlap_skills: ['Retail Store Remodel CAD', 'Commercial Space Planning', 'Revit BIM', 'Floorplan Drafting'], why_recommended: 'Dedicated retail space planning and store remodel CAD drafting team with 100% direct domain workflow overlap.' },
      { name: 'Lowe\'s India', category: 'gcc', tier_level: 'Tier 1', tier: 'Tier-1 Retail Facility & Store CAD Hub', location: 'Bangalore', description: 'Retail store design, commercial space planning, and remodel CAD drafting operations', overlap_skills: ['Retail Store Layout CAD', 'Fixture Planning', 'Revit Commercial BIM', 'AutoCAD Drafting'], why_recommended: 'Large-scale retail space planning, store fixture layout, and architectural remodel drafting CoE.' },
      { name: 'Walmart Global Tech', category: 'gcc', tier_level: 'Tier 1', tier: 'Tier-1 Retail Space Planning & Tech GCC', location: 'Bangalore / Chennai', description: 'Global retail facility planning, store layout CAD modeling, and digital building operations', overlap_skills: ['Global Retail Remodel CAD', 'Commercial Store Layouts', 'BIM Documentation', 'Building Systems'], why_recommended: 'Enterprise retail architectural remodel planning team maintaining global high-volume store floorplans.' },

      // Tier 2: Premier Engineering Consultancies, Big 4 & GSIs
      { name: 'L&T Technology Services (LTTS)', category: 'gsi', tier_level: 'Tier 2', tier: 'Tier-2 Premier Digital Engineering Provider', location: 'Bangalore / Vadodara / Chennai', description: 'Leading engineering design services with deep AutoCAD, Revit, and facility design practices', overlap_skills: ['AutoCAD Plant 3D', 'Revit MEP', 'Facility Engineering', 'Architectural Drafting'], why_recommended: 'Established engineering services provider with a massive bench of multi-disciplinary building drafting specialists.' },
      { name: 'Tata Elxsi', category: 'gsi', tier_level: 'Tier 2', tier: 'Tier-2 Engineering Design Specialist', location: 'Bangalore / Pune / Trivandrum', description: 'Architectural rendering, spatial design, and digital engineering documentation', overlap_skills: ['Architectural 3D Rendering', 'Spatial Design', 'AutoCAD Drafting', 'Digital Engineering Documentation'], why_recommended: 'Design-led engineering consultancy delivering commercial space modeling and high-precision spatial layouts.' },
      { name: 'Cyient', category: 'gsi', tier_level: 'Tier 2', tier: 'Tier-2 Geospatial & Engineering Design Leader', location: 'Hyderabad / Bangalore / Noida', description: 'Large-scale utility, facility documentation, CAD drafting, and spatial modeling CoE', overlap_skills: ['Utilities CAD', 'MicroStation Drafting', 'Large-scale Facility Documentation', 'As-Built CAD'], why_recommended: 'High-volume technical drafting center with rigorous quality checks and multi-platform CAD drafting benches.' },
      { name: 'Quest Global', category: 'gsi', tier_level: 'Tier 2', tier: 'Tier-2 Global Engineering Services', location: 'Bangalore / Trivandrum / Pune', description: 'Mechanical, electrical, and commercial building systems engineering design', overlap_skills: ['Commercial Building Systems', 'Mechanical CAD', 'AutoCAD 2D/3D', 'Revit Documentation'], why_recommended: 'Comprehensive building engineered systems practice with strong electrical, mechanical, and architectural drafters.' },
      { name: 'WSP India', category: 'big4', tier_level: 'Tier 2', tier: 'Tier-2 Global Engineering & Design Consultancy', location: 'Noida / Bangalore / Mumbai', description: 'Premier international building engineering, BIM modeling, and architectural drafting firm', overlap_skills: ['Revit BIM Modeling', 'Commercial Building Systems', 'Structural CAD', 'Architectural Detailing'], why_recommended: 'Premier international engineering firm working on landmark commercial structures and multi-trade BIM models.' },
      { name: 'Jacobs India', category: 'big4', tier_level: 'Tier 2', tier: 'Tier-2 Global Technical & Infrastructure Services', location: 'Mumbai / Hyderabad / Bangalore', description: 'Comprehensive commercial building engineered systems, Revit BIM, and project drafting', overlap_skills: ['Comprehensive Building Systems', 'Revit BIM Coordination', 'AutoCAD', 'MicroStation'], why_recommended: 'Elite global architectural engineering advisory with deep expertise in commercial facilities and building systems.' },
      { name: 'AtkinsRéalis', category: 'big4', tier_level: 'Tier 2', tier: 'Tier-2 Engineering, Design & Project Management', location: 'Bangalore / Gurgaon / Mumbai', description: 'High-end architectural modeling, MicroStation drafting, and BIM asset coordination', overlap_skills: ['MicroStation Drafting', 'Revit Asset Coordination', 'Architectural Space Planning', 'BIM Compliance'], why_recommended: 'High-rigor architectural and structural design consultancy with deep MicroStation and Revit coordination specialists.' },
      { name: 'Neilsoft', category: 'gsi', tier_level: 'Tier 2', tier: 'Tier-2 Digital Engineering & BIM Services', location: 'Pune / Bangalore / Ahmedabad', description: 'Multi-disciplinary engineering design, BIM modeling, and architectural drafting services', overlap_skills: ['Architectural CAD Drafting', 'BIM 360', 'Revit Modeling', 'Clash Detection'], why_recommended: 'Focused digital engineering practice with specialized delivery teams in commercial architectural modeling and documentation.' },
      { name: 'Pinnacle Infotech', category: 'oem', tier_level: 'Tier 2', tier: 'Tier-2 Global BIM Solutions Leader', location: 'Durgapur / Kolkata / Jaipur', description: 'Global building information modeling and pre-construction engineering services', overlap_skills: ['BIM Engineering', 'Revit Detailing', 'Pre-construction CAD', 'MEP Modeling'], why_recommended: 'Dedicated global BIM drafting powerhouse delivering high-speed, detailed architectural and MEP models.' },

      // Tier 3: Specialized Boutique CAD Providers & Scan-to-BIM Studios
      { name: 'Cadsys India', category: 'gsi', tier_level: 'Tier 3', tier: 'Tier-3 Utility CAD & Legacy Conversion Specialist', location: 'Hyderabad', description: 'Specialized drafting services for utility network mapping, 2D drafting, and CAD conversion', overlap_skills: ['2D AutoCAD Drafting', 'Paper-to-CAD Conversion', 'Utility Mapping', 'Floorplan Redlines'], why_recommended: 'Boutique CAD drafting vendor providing cost-effective drafters skilled in rapid redline markups and legacy drawing updates.' },
      { name: 'Techture', category: 'gsi', tier_level: 'Tier 3', tier: 'Tier-3 BIM Coordination & Scan-to-BIM Studio', location: 'Nagpur / Indore / Pune', description: 'Boutique BIM consulting firm specializing in point-cloud to BIM and clash detection', overlap_skills: ['Scan-to-BIM', 'Point Cloud Modeling', 'Revit As-Built Documentation', 'Clash Resolution'], why_recommended: 'Specialized BIM boutique focused on existing building documentation, as-built surveys, and remodel drafting.' },
      { name: 'Magnasoft', category: 'gsi', tier_level: 'Tier 3', tier: 'Tier-3 Geospatial & Spatial CAD Drafting', location: 'Bangalore / Hyderabad', description: 'Spatial data engineering, architectural floorplan digitization, and GIS mapping', overlap_skills: ['AutoCAD Drafting', 'Spatial Floorplan Modeling', 'GIS Mapping', 'Building CAD Assets'], why_recommended: 'Regional drafting center with skilled drafters accustomed to high-volume commercial asset mapping.' },
      { name: 'Epitome AEC', category: 'gsi', tier_level: 'Tier 3', tier: 'Tier-3 Architectural 3D Modeling & Detailing', location: 'Noida / Delhi', description: 'AEC drafting services specializing in commercial shop drawings and interior architectural CAD', overlap_skills: ['Commercial Interior CAD', 'Architectural Detailing', 'Revit Families', 'AutoCAD Layouts'], why_recommended: 'Fast-turnaround AEC detailing studio providing agile AutoCAD and Revit drafters for architectural renovations.' },
      { name: 'Desirazu Associates', category: 'gsi', tier_level: 'Tier 3', tier: 'Tier-3 Commercial Building & MEP CAD Design', location: 'Bangalore / Chennai', description: 'Building services consultancy providing commercial MEP, HVAC, and building drawing services', overlap_skills: ['Building Engineered Systems', 'AutoCAD MEP', 'Commercial Layout Drafting', 'Detail Drawings'], why_recommended: 'Specialist building engineering studio with experienced drafters for commercial building services.' },
    ],
  },

  // 11. Workforce Management (WFM) & Contact Center Operations Ecosystem
  {
    keywords: ['wfm', 'workforce management', 'rtm', 'real-time management', 'intraday', 'service level', 'asa', 'aht', 'occupancy', 'shrinkage', 'adherence', 'nice wfm', 'verint', 'genesys', 'contact center', 'call center', 'bpo', 'teleperformance', 'concentrix'],
    ecosystemName: 'Workforce Management (WFM) & Contact Center Operations Ecosystem',
    companies: [
      { name: 'NICE Systems', category: 'oem', tier_level: 'Tier 1', tier: 'Tier-1 WFM & CX Software OEM', location: 'Pune / Bangalore', description: 'OEM creator of NICE IEX WFM suite, CXone, and workforce engagement analytics.' },
      { name: 'Verint Systems India', category: 'oem', tier_level: 'Tier 1', tier: 'Tier-1 WFM & Customer Engagement OEM', location: 'Bangalore / Gurgaon', description: 'Enterprise WFM software OEM specializing in forecasting and intraday scheduling.' },
      { name: 'Genesys Telecommunications', category: 'oem', tier_level: 'Tier 1', tier: 'Tier-1 Omnichannel CCaaS & WFM OEM', location: 'Chennai / Hyderabad / Bangalore', description: 'Global CCaaS platform provider with native WFM and ACD routing.' },
      { name: 'Amazon Development Center (Customer Service Tech / GCC)', category: 'gcc', tier_level: 'Tier 1', tier: 'Tier-1 Global Consumer GCC Operations', location: 'Hyderabad / Bangalore / Chennai', description: 'Global customer service command center with massive centralized WFM and RTM desks.' },
      { name: 'Target India (Contact Center & Operations GCC)', category: 'gcc', tier_level: 'Tier 1', tier: 'Tier-1 Retail GCC Operations Command', location: 'Bangalore', description: 'Global capability center managing guest service operations, real-time queues, and scheduling.' },
      { name: 'American Express India (Global Servicing GCC)', category: 'gcc', tier_level: 'Tier 1', tier: 'Tier-1 Financial Services Operations GCC', location: 'Gurgaon / Bangalore', description: 'High-governance financial contact center running strict intraday workforce management.' },
      { name: 'Teleperformance India', category: 'gsi', tier_level: 'Tier 2', tier: 'Tier-2 Global Contact Center BPO Leader', location: 'Gurgaon / Mumbai / Bangalore / Hyderabad', description: 'World\'s largest contact center BPO with dedicated centralized WFM/RTM command centers.' },
      { name: 'Concentrix India', category: 'gsi', tier_level: 'Tier 2', tier: 'Tier-2 Global CX BPO Provider', location: 'Bangalore / Gurgaon / Hyderabad / Chennai', description: 'Premier customer experience solutions provider running complex multi-channel WFM operations.' },
      { name: 'Genpact (Customer Care & Contact Center BPS)', category: 'gsi', tier_level: 'Tier 2', tier: 'Tier-2 Global BPO & Enterprise Operations', location: 'Gurgaon / Hyderabad / Bangalore / Jaipur', description: 'Enterprise BPM and digital operations managing client contact centers and capacity planning.' },
      { name: 'Tech Mahindra (BPS / Customer Experience)', category: 'gsi', tier_level: 'Tier 2', tier: 'Tier-2 Enterprise BPS Practice', location: 'Pune / Noida / Bangalore / Hyderabad', description: 'Scalable customer care contact center operations with dedicated workforce management teams.' },
      { name: 'Wipro (Customer Experience & BPO Services)', category: 'gsi', tier_level: 'Tier 2', tier: 'Tier-2 Global GSI & BPO Operations', location: 'Bangalore / Chennai / Hyderabad', description: 'Global business services managing omnichannel contact centers and ACD routing.' },
      { name: 'Infosys BPM (Customer Service Operations)', category: 'gsi', tier_level: 'Tier 2', tier: 'Tier-2 Global BPM Leader', location: 'Bangalore / Pune / Jaipur', description: 'Global BPM provider with specialized contact center WFM analysts.' },
      { name: 'WNS Global Services (Customer Experience)', category: 'gsi', tier_level: 'Tier 2', tier: 'Tier-2 BPM Specialist', location: 'Mumbai / Pune / Gurgaon / Bangalore', description: 'BPM leader with deep contact center operations and dedicated intraday service level monitoring.' },
      { name: 'Firstsource Solutions', category: 'gsi', tier_level: 'Tier 2', tier: 'Tier-2 Specialized CX Management Leader', location: 'Bangalore / Mumbai / Chennai', description: 'Specialized business process provider with dedicated intraday queue coordination desks.' },
      { name: 'Hinduja Global Solutions (HGS)', category: 'other', tier_level: 'Tier 3', tier: 'Tier-3 Contact Center & BPM Provider', location: 'Bangalore / Mumbai / Hyderabad / Chennai', description: 'Specialized customer engagement provider running dedicated WFM and SLA reporting.' },
      { name: 'Conduent India', category: 'other', tier_level: 'Tier 3', tier: 'Tier-3 Business Services Provider', location: 'Bangalore / Hyderabad / Noida / Gurgaon', description: 'Specialized enterprise shared services managing transactional contact center queues.' },
      { name: 'EXL Service (Customer Operations & Analytics)', category: 'other', tier_level: 'Tier 3', tier: 'Tier-3 Operations Management & Analytics', location: 'Noida / Gurgaon / Bangalore / Pune', description: 'Operations management specialist with analytics-driven intraday scheduling and reporting.' },
      { name: 'Startek India (formerly Aegis)', category: 'other', tier_level: 'Tier 3', tier: 'Tier-3 CX & BPO Outsourcing Firm', location: 'Mumbai / Gurgaon / Bangalore / Bhopal', description: 'Customer engagement outsourcing firm with regional operations and real-time floor monitoring.' },
    ],
  },

  // 12. Business Analysis, Enterprise Analytics & BI Sourcing Ecosystem
  {
    keywords: ['business analyst', 'business analysis', 'data analysis', 'bi', 'power bi', 'tableau', 'sql', 'analytics', 'kpi', 'dashboard', 'requirements gathering', 'stakeholder management'],
    ecosystemName: 'Business Analysis, Enterprise Analytics & BI Sourcing Ecosystem',
    companies: [
      { name: 'Microsoft IDC', category: 'oem', tier_level: 'Tier 1', tier: 'Tier-1 Platform OEM & Analytics CoE', location: 'Hyderabad / Bangalore / Noida', description: 'Creator of Power BI, Azure Synapse, and enterprise SQL engines.' },
      { name: 'Google India', category: 'oem', tier_level: 'Tier 1', tier: 'Tier-1 Hyperscaler & Analytics OEM', location: 'Bangalore / Hyderabad / Gurgaon', description: 'Product engineering for BigQuery, Looker, and data cloud platforms.' },
      { name: 'Target India (Enterprise Analytics GCC)', category: 'gcc', tier_level: 'Tier 1', tier: 'Tier-1 Retail Analytics GCC', location: 'Bangalore', description: 'Advanced retail analytics CoE driving store merchandising and guest intelligence.' },
      { name: 'Walmart Global Tech', category: 'gcc', tier_level: 'Tier 1', tier: 'Tier-1 Retail & Supply Chain Analytics GCC', location: 'Bangalore / Chennai', description: 'Enterprise analytics hub solving global retail forecasting and inventory optimization.' },
      { name: 'JPMorgan Chase GCC', category: 'gcc', tier_level: 'Tier 1', tier: 'Tier-1 Banking Analytics GCC', location: 'Hyderabad / Bangalore / Mumbai', description: 'Corporate & investment bank data analytics hub running risk analysis and dashboard reporting.' },
      { name: 'Deloitte', category: 'big4', tier_level: 'Tier 2', tier: 'Tier-2 Big 4 Advisory & Analytics Leader', location: 'Hyderabad / Bangalore / Mumbai', description: 'Market-leading enterprise business analysis and analytics strategy practice.' },
      { name: 'PwC', category: 'big4', tier_level: 'Tier 2', tier: 'Tier-2 Big 4 Management Consulting', location: 'Bangalore / Hyderabad / Kolkata', description: 'Business transformation practice translating business needs into data architectures.' },
      { name: 'EY', category: 'big4', tier_level: 'Tier 2', tier: 'Tier-2 Big 4 Advisory Practice', location: 'Bangalore / Gurgaon / Mumbai', description: 'Analytics advisory and business analysis practice driving enterprise insights.' },
      { name: 'Accenture', category: 'gsi', tier_level: 'Tier 2', tier: 'Tier-2 Global Systems Integrator Leader', location: 'Bangalore / Hyderabad / Pune', description: 'Global scale delivery in business process re-engineering and BI solutions.' },
      { name: 'TCS', category: 'gsi', tier_level: 'Tier 2', tier: 'Tier-2 Global Tier 1 GSI', location: 'Mumbai / Bangalore / Chennai', description: 'Deep business analyst bench across BFSI, retail, healthcare, and manufacturing.' },
      { name: 'Infosys', category: 'gsi', tier_level: 'Tier 2', tier: 'Tier-2 Global Tier 1 GSI', location: 'Bangalore / Hyderabad / Pune', description: 'Enterprise analytics practice delivering business insights and predictive models.' },
      { name: 'Mu Sigma', category: 'other', tier_level: 'Tier 3', tier: 'Tier-3 Pure-play Decision Sciences Firm', location: 'Bangalore', description: 'Pioneer pure-play decision sciences firm providing business decision modeling.' },
      { name: 'Fractal Analytics', category: 'other', tier_level: 'Tier 3', tier: 'Tier-3 AI & Pure-play Analytics Provider', location: 'Mumbai / Bangalore / Gurgaon', description: 'Premier enterprise AI and decision intelligence consulting firm.' },
      { name: 'Tiger Analytics', category: 'other', tier_level: 'Tier 3', tier: 'Tier-3 Dedicated Advanced Analytics Consultancy', location: 'Chennai / Bangalore / Hyderabad', description: 'Consulting firm specializing in custom business analytics and BI solutions.' },
      { name: 'LatentView Analytics', category: 'other', tier_level: 'Tier 3', tier: 'Tier-3 Pure-play Digital Analytics Specialist', location: 'Chennai / Bangalore', description: 'Pure-play digital analytics firm partnering with Fortune 500 enterprises.' },
      { name: 'ZS Associates', category: 'other', tier_level: 'Tier 3', tier: 'Tier-3 Management Consulting & Analytics Firm', location: 'Pune / Gurgaon / Bangalore', description: 'Global management consulting and technology firm focused on commercial analytics.' },
    ],
  },
];

// Fallback ecosystem if JD does not match specific vertical keywords
const DEFAULT_COMPANY_ECOSYSTEM = {
  ecosystemName: 'General Enterprise IT & Consulting Ecosystem',
  companies: [
    { name: 'Microsoft', category: 'oem', tier: 'Technology OEM', location: 'Hyderabad / Bangalore / Noida', description: 'Cloud, enterprise software & developer platforms' },
    { name: 'Google', category: 'oem', tier: 'Hyperscaler OEM', location: 'Bangalore / Hyderabad', description: 'Cloud infrastructure & enterprise AI systems' },
    { name: 'Amazon', category: 'oem', tier: 'Cloud & Tech OEM', location: 'Bangalore / Hyderabad / Chennai', description: 'Distributed systems & enterprise services' },
    { name: 'Deloitte', category: 'big4', tier: 'Big 4 Leader', location: 'Hyderabad / Bangalore / Mumbai', description: 'Enterprise advisory & technology consulting' },
    { name: 'PwC', category: 'big4', tier: 'Global Advisory', location: 'Bangalore / Hyderabad / Kolkata', description: 'Technology transformation & systems advisory' },
    { name: 'EY', category: 'big4', tier: 'Advisory Practice', location: 'Bangalore / Gurgaon / Mumbai', description: 'Business & technology transformation' },
    { name: 'KPMG', category: 'big4', tier: 'Advisory Firm', location: 'Bangalore / Mumbai / Pune', description: 'Enterprise systems & management consulting' },
    { name: 'TCS', category: 'gsi', tier: 'Global Tier 1 GSI', location: 'Chennai / Hyderabad / Bangalore', description: 'Global IT services & enterprise consulting' },
    { name: 'Infosys', category: 'gsi', tier: 'Global Tier 1 GSI', location: 'Bangalore / Hyderabad / Pune', description: 'Enterprise software & digital services' },
    { name: 'Accenture', category: 'gsi', tier: 'Global Integrator Leader', location: 'Bangalore / Hyderabad / Pune', description: 'End-to-end enterprise technology delivery' },
    { name: 'Wipro', category: 'gsi', tier: 'Global Tier 1 GSI', location: 'Bangalore / Hyderabad / Chennai', description: 'IT infrastructure & enterprise solutions' },
    { name: 'Cognizant', category: 'gsi', tier: 'Global Tier 1 GSI', location: 'Chennai / Hyderabad / Bangalore', description: 'Technology consulting & domain solutions' },
    { name: 'Capgemini', category: 'gsi', tier: 'European Tier 1 GSI', location: 'Bangalore / Mumbai / Pune', description: 'Digital engineering & enterprise consulting' },
    { name: 'HCLTech', category: 'gsi', tier: 'Global IT Services', location: 'Noida / Bangalore / Chennai', description: 'Enterprise engineering & IT infrastructure' },
    { name: 'LTIMindtree', category: 'gsi', tier: 'Tier 1 GSI', location: 'Bangalore / Mumbai / Pune', description: 'Digital transformation & enterprise services' },
    { name: 'JPMorgan Chase', category: 'gcc', tier: 'Top Banking GCC', location: 'Bangalore / Hyderabad / Mumbai', description: 'Global financial services engineering hub' },
    { name: 'Wells Fargo', category: 'gcc', tier: 'Banking Tech GCC', location: 'Hyderabad / Bangalore / Chennai', description: 'Enterprise technology & operations center' },
    { name: 'Walmart Global Tech', category: 'gcc', tier: 'Retail Tech Hub', location: 'Bangalore / Chennai', description: 'Global supply chain & e-commerce technology' },
  ],
};

// Export JobDetail component for displaying deep specifications and matched applicants with customizable status.
export const JobDetail = ({
  job,
  allJobs = [],
  onSelectJob,
  matchingCandidates = [],
  allCandidates = [],
  isLoadingMatches = false,
  onAnalyzeJob,
  onSelectCandidate,
  onEditJob,
  onUpdateJob,
  onOpenSegmentation,
  onOpenMatrix,
  onNavigateToJob,
  onCompareWithCandidate,
  onOpenComparison,
  onRefreshApprovals,
  isFullPageView = false,
  onToggleFullPageView,
}) => {
  const [approvalSentMsg, setApprovalSentMsg] = useState('');
  const [naukriStrictAnd, setNaukriStrictAnd] = useState(true);
  const [searchDepth, setSearchDepth] = useState('balanced');
  const [searchHistory, setSearchHistory] = useState([]);
  const [generatedQueries, setGeneratedQueries] = useState(null);
  const [booleanLoading, setBooleanLoading] = useState(false);
  const [booleanError, setBooleanError] = useState('');
  const [includePreferredInBoolean, setIncludePreferredInBoolean] = useState(false);
  const [includeCompaniesInBoolean, setIncludeCompaniesInBoolean] = useState(false);
  const [includeLocationInBoolean, setIncludeLocationInBoolean] = useState(false);
  const [includeNoticeInBoolean, setIncludeNoticeInBoolean] = useState(false);
  const [includeExclusionsInBoolean, setIncludeExclusionsInBoolean] = useState(false);
  const [includeSeniorityInBoolean, setIncludeSeniorityInBoolean] = useState(false);
  const [sourcingPlatform, setSourcingPlatform] = useState('naukri'); // 'naukri' | 'linkedin' | 'xray' | 'keywords'
  const [keywordDelimiter, setKeywordDelimiter] = useState('comma'); // 'comma' | 'space' | 'pipe'
  const [candidateKeywordFilter, setCandidateKeywordFilter] = useState('');
  const [selectedCompanies, setSelectedCompanies] = useState([]);
  const [excludedCompanies, setExcludedCompanies] = useState([]);
  const [companyCategoryFilter, setCompanyCategoryFilter] = useState('all'); // 'all' | 'oem' | 'big4' | 'gsi' | 'gcc'
  const [companyTierFilter, setCompanyTierFilter] = useState('all'); // 'all' | 'tier1' | 'tier2' | 'tier3'
  const [companySearchQuery, setCompanySearchQuery] = useState('');
  const [customCompanies, setCustomCompanies] = useState([]);
  const [customCompanyInput, setCustomCompanyInput] = useState('');
  const [customCompanyCategory, setCustomCompanyCategory] = useState('gsi');
  const [customCompanyLocation, setCustomCompanyLocation] = useState('');
  const [showAddCompanyInput, setShowAddCompanyInput] = useState(false);
  const [showMarketReportModal, setShowMarketReportModal] = useState(false);
  const [copiedBoolean, setCopiedBoolean] = useState(false);
  const [copiedTargetClause, setCopiedTargetClause] = useState(false);
  const [copiedExcludedClause, setCopiedExcludedClause] = useState(false);
  const [copiedOriginalSource, setCopiedOriginalSource] = useState(false);
  // View mode for talent sourcing companies: 'cards' (rich cards) or 'tags' (compact chips)
  const [companyViewMode, setCompanyViewMode] = useState('cards');
  // Talent Sourcing Strategy selector state
  const [sourcingStrategy, setSourcingStrategy] = useState('tier1');

  // Dynamic Target Companies from backend
  const [targetCompaniesData, setTargetCompaniesData] = useState(null);
  const [targetCompaniesLoading, setTargetCompaniesLoading] = useState(false);
  const [targetCompaniesError, setTargetCompaniesError] = useState('');

  // Conversational Boolean Customization with AI
  const [aiQueryInstruction, setAiQueryInstruction] = useState('');
  const [aiQueryCustomizing, setAiQueryCustomizing] = useState(false);
  const [aiQueryExplanation, setAiQueryExplanation] = useState('');
  const [aiSuggestions, setAiSuggestions] = useState(null);
  const [aiStatusNotice, setAiStatusNotice] = useState('');
  const [aiValidationWarnings, setAiValidationWarnings] = useState([]);
  const [newSuggestionChip, setNewSuggestionChip] = useState({ titles: '', mandatory_skills: '', related_skills: '', industries: '', exclusions: '' });

  // Custom Query Editor state
  const [isCustomMode, setIsCustomMode] = useState(false);
  const [customQueryText, setCustomQueryText] = useState('');
  const queryInputRef = useRef(null);

  // Copied state for Interview Kit
  const [copiedKit, setCopiedKit] = useState(false);

  // Inline JD editing state
  const [isEditingJD, setIsEditingJD] = useState(false);
  const [isSavingJD, setIsSavingJD] = useState(false);
  const [jdEditError, setJdEditError] = useState('');
  const [jdEditForm, setJdEditForm] = useState({
    title: '',
    department: '',
    location: '',
    minYears: '',
    maxYears: '',
    requiredSkillsText: '',
    preferredSkillsText: '',
    description: '',
  });

  useEffect(() => {
    setIsEditingJD(false);
    setJdEditError('');
  }, [job?.id]);

  // Collapsible section state for executive focus & clutter reduction
  const [openSections, setOpenSections] = useState({
    summary: true, // open in detailed JD Specifications
    competencies: true, // open in detailed JD Specifications
    screeningKit: true, // open in detailed JD Specifications
    companies: true, // open in Talent Sourcing
    boolean: true, // open in Talent Sourcing
    matches: true, // open in Candidate Matching
    aiIntelligence: true, // open in AI Intelligence
    jobPosting: true, // open in Job Posting & Distribution
  });

  // Scope Tab: 'structured' | 'original'
  const [scopeTab, setScopeTab] = useState('structured');

  // Active view tab filter: one of the five JD workspace sections.
  const [activeViewFilter, setActiveViewFilter] = useState('specifications');
  const scoredMatchValues = matchingCandidates
    .map((candidate) => candidate.matchScore ?? candidate.match_score)
    .filter((score) => score != null);

  const toggleSection = (key) => {
    setOpenSections((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const isAllExpanded = useMemo(() => {
    if (activeViewFilter === 'specifications') {
      return Boolean(openSections.summary && openSections.competencies && openSections.screeningKit);
    }
    if (activeViewFilter === 'sourcing') {
      return Boolean(openSections.companies && openSections.boolean);
    }
    if (activeViewFilter === 'candidates') {
      return Boolean(openSections.matches);
    }
    if (activeViewFilter === 'aiIntelligence') {
      return Boolean(openSections.aiIntelligence);
    }
    if (activeViewFilter === 'jobPosting') {
      return Boolean(openSections.jobPosting);
    }
    return Object.values(openSections).every(Boolean);
  }, [openSections, activeViewFilter]);

  const toggleAllSections = () => {
    const nextState = !isAllExpanded;
    if (activeViewFilter === 'specifications') {
      setOpenSections((prev) => ({
        ...prev,
        summary: nextState,
        competencies: nextState,
        screeningKit: nextState,
      }));
    } else if (activeViewFilter === 'sourcing') {
      setOpenSections((prev) => ({
        ...prev,
        companies: nextState,
        boolean: nextState,
      }));
    } else if (activeViewFilter === 'candidates') {
      setOpenSections((prev) => ({
        ...prev,
        matches: nextState,
      }));
    } else if (activeViewFilter === 'aiIntelligence') {
      setOpenSections((prev) => ({
        ...prev,
        aiIntelligence: nextState,
      }));
    } else if (activeViewFilter === 'jobPosting') {
      setOpenSections((prev) => ({
        ...prev,
        jobPosting: nextState,
      }));
    }
  };

  const handleSelectViewFilter = (filterId) => {
    setActiveViewFilter(filterId);
    if (filterId === 'candidates') {
      setOpenSections((prev) => ({
        ...prev,
        matches: true,
      }));
    } else if (filterId === 'sourcing') {
      setOpenSections((prev) => ({
        ...prev,
        companies: true,
        boolean: true,
      }));
    } else if (filterId === 'aiIntelligence') {
      setOpenSections((prev) => ({
        ...prev,
        aiIntelligence: true,
      }));
    } else if (filterId === 'jobPosting') {
      setOpenSections((prev) => ({
        ...prev,
        jobPosting: true,
      }));
    } else if (filterId === 'specifications') {
      setOpenSections((prev) => ({
        ...prev,
        summary: true,
        competencies: true,
        screeningKit: true,
      }));
    }
  };

  const shouldShowSection = (key) => {
    if (activeViewFilter === 'specifications') return key === 'summary' || key === 'competencies' || key === 'screeningKit';
    if (activeViewFilter === 'sourcing') return key === 'boolean' || key === 'companies';
    if (activeViewFilter === 'candidates') return key === 'matches';
    if (activeViewFilter === 'aiIntelligence') return key === 'aiIntelligence';
    if (activeViewFilter === 'jobPosting') return key === 'jobPosting';
    return false;
  };

  // Reset company selection, custom query & copy state when switching jobs.
  useEffect(() => {
    setSelectedCompanies([]);
    setExcludedCompanies([]);
    setCompanyCategoryFilter('all');
    setCompanySearchQuery('');
    setCustomCompanies([]);
    setCustomCompanyInput('');
    setCustomCompanyCategory('gsi');
    setCustomCompanyLocation('');
    setShowAddCompanyInput(false);
    setShowMarketReportModal(false);
    setCopiedBoolean(false);
    setCopiedTargetClause(false);
    setCopiedExcludedClause(false);
    setCopiedOriginalSource(false);
    setIsCustomMode(false);
    setCustomQueryText('');
    setCandidateKeywordFilter('');
    setSearchHistory([]);
    setGeneratedQueries(null);
    setBooleanError('');
    setTargetCompaniesData(null);
    setTargetCompaniesError('');
    setAiQueryInstruction('');
    setAiQueryExplanation('');
    setAiSuggestions(null);
    setAiStatusNotice('');
    setAiValidationWarnings([]);

    let active = true;
    if (job?.id) {
      jobApi.getBooleanSearchHistory(job.numeric_id || job.id)
        .then((rows) => {
          if (active) setSearchHistory(Array.isArray(rows) ? rows : []);
        })
        .catch(() => {
          if (active) setSearchHistory([]);
        });

      // Fetch dynamic target company recommendations from backend catalog
      setTargetCompaniesLoading(true);
      jobApi.getTargetCompanies(job.numeric_id || job.id)
        .then((data) => {
          if (active) {
            setTargetCompaniesData(data);
            if (data?.primary_strategy) {
              setSourcingStrategy(data.primary_strategy);
            }
          }
        })
        .catch((err) => {
          if (active) setTargetCompaniesError(err?.message || 'Failed to load target companies');
        })
        .finally(() => {
          if (active) setTargetCompaniesLoading(false);
        });
    }

    return () => {
      active = false;
    };
  }, [job?.id]);


  useEffect(() => {
    if (!job?.id || isCustomMode) return;
    let cancelled = false;
    setBooleanLoading(true);
    setBooleanError('');
    jobApi.generateBooleanQueries(job.numeric_id || job.id, {
      search_mode: searchDepth,
      custom_mandatory: job.requiredSkills?.length ? job.requiredSkills : null,
      custom_preferred: job.preferredSkills?.length ? job.preferredSkills : null,
      custom_exclusions: includeExclusionsInBoolean ? ['Intern', 'Trainee', 'Student', 'Fresher'] : [],
      target_companies: includeCompaniesInBoolean
        ? (selectedCompanies.length ? selectedCompanies : allCompanies.slice(0, 4).map((item) => item.name || item))
        : [],
    }).then((response) => {
      if (!cancelled) setGeneratedQueries(response);
    }).catch((error) => {
      if (!cancelled) setBooleanError(error?.message || 'Boolean generation failed');
    }).finally(() => {
      if (!cancelled) setBooleanLoading(false);
    });
    return () => { cancelled = true; };
  }, [
    job?.id,
    job?.numeric_id,
    searchDepth,
    isCustomMode,
    includeExclusionsInBoolean,
    includeCompaniesInBoolean,
    selectedCompanies,
  ]);

  // Handle Conversational Boolean Customization with Ollama AI
  const handleAIQueryCustomizationSubmit = async (e) => {
    e?.preventDefault();
    const inst = aiQueryInstruction.trim();
    if (!inst || !job?.id) return;
    setAiQueryCustomizing(true);
    setAiQueryExplanation('');
    try {
      const res = await jobApi.customizeBooleanQueries(job.numeric_id || job.id, {
        instruction: inst,
        search_mode: searchDepth,
        custom_mandatory: job.requiredSkills?.length ? job.requiredSkills : null,
        custom_preferred: job.preferredSkills?.length ? job.preferredSkills : null,
        custom_exclusions: includeExclusionsInBoolean ? ['Intern', 'Trainee', 'Student', 'Fresher'] : [],
        target_companies: includeCompaniesInBoolean
          ? (selectedCompanies.length ? selectedCompanies : allCompanies.slice(0, 4).map((item) => item.name || item))
          : [],
      });
      if (res) {
        let newQuery = '';
        if (sourcingPlatform === 'naukri' && res.naukri?.query) {
          newQuery = res.naukri.query;
        } else if (sourcingPlatform === 'linkedin' && res.linkedin?.query) {
          newQuery = res.linkedin.query;
        } else if (sourcingPlatform === 'xray' && res.google_xray?.query) {
          newQuery = res.google_xray.query;
        } else if (res.customized_query) {
          newQuery = res.customized_query;
        } else if (res.naukri?.query) {
          newQuery = res.naukri.query;
        }
        if (newQuery) {
          setCustomQueryText(newQuery);
          setIsCustomMode(true);
          setAiQueryExplanation(res.customization_applied || res.explanation || 'Customization applied successfully');
        }
        if (res.interpreted_suggestions) {
          setAiSuggestions(res.interpreted_suggestions);
        }
        setAiStatusNotice(res.ai_status || '');
        setAiValidationWarnings(Array.isArray(res.validation_warnings) ? res.validation_warnings : []);
      }
    } catch (err) {
      console.warn('AI Boolean customization failed:', err.message);
      setAiQueryExplanation(`Customization failed: ${err.message}`);
    } finally {
      setAiQueryCustomizing(false);
    }
  };

  // Regenerate Boolean query directly from the recruiter's edited suggestion chips
  const handleApplyEditedSuggestions = async () => {
    if (!aiSuggestions || !job?.id) return;
    setAiQueryCustomizing(true);
    try {
      const res = await jobApi.customizeBooleanQueries(job.numeric_id || job.id, {
        instruction: aiQueryInstruction.trim(),
        search_mode: aiSuggestions.search_mode || searchDepth,
        custom_mandatory: aiSuggestions.mandatory_skills || [],
        custom_preferred: aiSuggestions.related_skills || [],
        custom_exclusions: aiSuggestions.exclusions || [],
        custom_titles: aiSuggestions.titles || [],
        custom_related_skills: aiSuggestions.related_skills || [],
        custom_industries: aiSuggestions.industries || [],
        custom_location: aiSuggestions.location_preference || '',
        experience_preference: aiSuggestions.experience_preference || '',
        apply_edited_suggestions: true,
        target_companies: includeCompaniesInBoolean
          ? (selectedCompanies.length ? selectedCompanies : allCompanies.slice(0, 4).map((item) => item.name || item))
          : [],
      });
      if (res) {
        const nextQuery =
          (sourcingPlatform === 'linkedin' && res.linkedin?.query) ||
          (sourcingPlatform === 'xray' && res.google_xray?.query) ||
          res.naukri?.query ||
          res.customized_query ||
          '';
        if (nextQuery) {
          setCustomQueryText(nextQuery);
          setIsCustomMode(true);
        }
        if (res.interpreted_suggestions) setAiSuggestions(res.interpreted_suggestions);
        setAiQueryExplanation(res.customization_applied || 'Regenerated query from edited suggestions.');
        setAiValidationWarnings(Array.isArray(res.validation_warnings) ? res.validation_warnings : []);
      }
    } catch (err) {
      setAiQueryExplanation(`Regeneration failed: ${err.message}`);
    } finally {
      setAiQueryCustomizing(false);
    }
  };

  const removeSuggestionChip = (field, idx) => {
    setAiSuggestions((prev) =>
      prev ? { ...prev, [field]: (prev[field] || []).filter((_, i) => i !== idx) } : prev
    );
  };

  const addSuggestionChip = (field) => {
    const val = (newSuggestionChip[field] || '').trim();
    if (!val) return;
    setAiSuggestions((prev) => {
      if (!prev) return prev;
      const existing = prev[field] || [];
      if (existing.some((x) => x.toLowerCase() === val.toLowerCase())) return prev;
      return { ...prev, [field]: [...existing, val] };
    });
    setNewSuggestionChip((prev) => ({ ...prev, [field]: '' }));
  };

  // Derive JD-related target sourcing companies strictly from backend LangGraph recommendations (never hardcoded const fallbacks)
  const relatedCompanyObjects = useMemo(() => {
    if (targetCompaniesData?.companies && Array.isArray(targetCompaniesData.companies)) {
      return targetCompaniesData.companies;
    }
    return [];
  }, [targetCompaniesData]);

  // Combined company objects list (derived + custom added)
  const allCompanyObjects = useMemo(() => {
    const list = [...relatedCompanyObjects];
    customCompanies.forEach((cust) => {
      const exists = list.some((c) => c.name.toLowerCase() === cust.name.toLowerCase());
      if (!exists) {
        list.push(cust);
      }
    });
    return list;
  }, [relatedCompanyObjects, customCompanies]);

  // Flat string array of all company names for backward compatibility
  const allCompanies = useMemo(() => {
    return allCompanyObjects.map((c) => c.name);
  }, [allCompanyObjects]);

  // Filtered company objects based on active category tab, tier filter & search query
  const filteredCompanyObjects = useMemo(() => {
    let list = allCompanyObjects;
    if (companyCategoryFilter !== 'all') {
      list = list.filter((c) => c.category === companyCategoryFilter);
    }
    if (companyTierFilter !== 'all') {
      list = list.filter((c) => {
        const lvl = (c.tier_level || '').toLowerCase();
        const tierDesc = (c.tier || '').toLowerCase();
        if (companyTierFilter === 'tier1') {
          return lvl === 'tier 1' || tierDesc.includes('tier 1') || tierDesc.includes('tier-1') || c.category === 'oem' || c.category === 'gcc';
        }
        if (companyTierFilter === 'tier2') {
          return lvl === 'tier 2' || tierDesc.includes('tier 2') || tierDesc.includes('tier-2') || c.category === 'gsi' || c.category === 'big4';
        }
        if (companyTierFilter === 'tier3') {
          return lvl === 'tier 3' || tierDesc.includes('tier 3') || tierDesc.includes('tier-3') || tierDesc.includes('boutique') || tierDesc.includes('specialist') || tierDesc.includes('regional');
        }
        return true;
      });
    }
    if (companySearchQuery.trim()) {
      const q = companySearchQuery.trim().toLowerCase();
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          (c.location && c.location.toLowerCase().includes(q)) ||
          (c.tier && c.tier.toLowerCase().includes(q)) ||
          (c.tier_level && c.tier_level.toLowerCase().includes(q)) ||
          (c.description && c.description.toLowerCase().includes(q))
      );
    }
    return list;
  }, [allCompanyObjects, companyCategoryFilter, companyTierFilter, companySearchQuery]);

  // Derive plain keywords list without Boolean operators (ideal for simple search bars, tags, and standard ATS)
  const plainKeywordsList = useMemo(() => {
    if (!job) return [];
    const list = [];

    const addTerm = (term) => {
      const cleaned = String(term || '').trim();
      if (cleaned && !list.some((existing) => existing.toLowerCase() === cleaned.toLowerCase())) {
        list.push(cleaned);
      }
    };

    // Role / Title keywords
    (job.title || '')
      .split(/[\/,|()-]+/)
      .map((t) => t.trim())
      .filter((t) => t.length > 2)
      .slice(0, 2)
      .forEach(addTerm);

    // Mandatory skills
    (job.requiredSkills || []).forEach(addTerm);

    // Preferred skills (if enabled)
    if (includePreferredInBoolean) {
      (job.preferredSkills || []).forEach(addTerm);
    }

    // Target companies (if enabled)
    if (includeCompaniesInBoolean) {
      const activeCompanies =
        selectedCompanies.length > 0 ? selectedCompanies : allCompanies.slice(0, 4);
      activeCompanies.forEach(addTerm);
    }

    // Location (if enabled)
    if (includeLocationInBoolean && job.location) {
      job.location
        .split(/[\/,]+/)
        .map((l) => l.trim())
        .filter((l) => l && !/india/i.test(l))
        .forEach(addTerm);
    }

    // Seniority (if enabled)
    if (includeSeniorityInBoolean) {
      addTerm('Senior');
      addTerm('Lead');
    }

    return list;
  }, [
    job,
    includePreferredInBoolean,
    includeCompaniesInBoolean,
    includeLocationInBoolean,
    includeSeniorityInBoolean,
    selectedCompanies,
    allCompanies,
  ]);

  // Format plain keywords list by user-selected delimiter
  const formattedPlainKeywords = useMemo(() => {
    if (!plainKeywordsList.length) return '';
    if (keywordDelimiter === 'space') {
      return plainKeywordsList.map((k) => (/\s/.test(k) ? `"${k}"` : k)).join(' ');
    }
    if (keywordDelimiter === 'pipe') {
      return plainKeywordsList.join(' | ');
    }
    // Default comma-separated
    return plainKeywordsList.join(', ');
  }, [plainKeywordsList, keywordDelimiter]);

  // Build ready-to-paste search string for Naukri, LinkedIn, Google X-Ray, or Plain Keywords.
  const autoBooleanQuery = useMemo(() => {
    if (!job) return '';

    const quote = (term) => {
      const cleaned = String(term || '').trim();
      if (!cleaned) return '';
      return /\s|[\/\-+&]/.test(cleaned) ? `"${cleaned}"` : cleaned;
    };

    const aiQueries = generatedQueries;
    const jobIdMatches = aiQueries && (
      String(aiQueries.job_id) === String(job.numeric_id || job.id) ||
      Number(aiQueries.job_id) === Number(job.numeric_id || job.id)
    );

    // If Plain Keywords mode is active, return formatted plain keywords string
    if (sourcingPlatform === 'keywords') {
      if (jobIdMatches && aiQueries.simple_keywords?.[keywordDelimiter]) {
        return aiQueries.simple_keywords[keywordDelimiter];
      }
      return formattedPlainKeywords;
    }

    // Determine platform base query
    let baseQuery = '';
    if (jobIdMatches) {
      if (sourcingPlatform === 'naukri' && aiQueries.naukri?.query) {
        if (searchDepth === 'strict' && aiQueries.advanced_strategies?.strict_and?.query) {
          baseQuery = aiQueries.advanced_strategies.strict_and.query;
        } else if (searchDepth === 'broad' && aiQueries.advanced_strategies?.broad_or?.query) {
          baseQuery = aiQueries.advanced_strategies.broad_or.query;
        } else {
          baseQuery = aiQueries.naukri.query;
        }
      } else if (sourcingPlatform === 'linkedin' && aiQueries.linkedin?.query) {
        if (searchDepth === 'strict' && aiQueries.advanced_strategies?.strict_and?.query) {
          baseQuery = aiQueries.advanced_strategies.strict_and.query;
        } else if (searchDepth === 'broad' && aiQueries.advanced_strategies?.broad_or?.query) {
          baseQuery = aiQueries.advanced_strategies.broad_or.query;
        } else {
          baseQuery = aiQueries.linkedin.query;
        }
      } else if (sourcingPlatform === 'xray' && aiQueries.google_xray?.query) {
        if (searchDepth === 'strict' && aiQueries.advanced_strategies?.strict_and?.query) {
          baseQuery = `site:linkedin.com/in ${aiQueries.advanced_strategies.strict_and.query}`;
        } else if (searchDepth === 'broad' && aiQueries.advanced_strategies?.broad_or?.query) {
          baseQuery = `site:linkedin.com/in ${aiQueries.advanced_strategies.broad_or.query}`;
        } else {
          baseQuery = aiQueries.google_xray.query;
        }
      }
    }

    // Deterministic fallback if API queries not yet returned
    if (!baseQuery) {
      const parts = [];
      const titleWords = (job.title || '')
        .split(/[\/,|()-]+/)
        .map((t) => t.trim())
        .filter((t) => t.length > 2)
        .slice(0, 3)
        .map(quote)
        .filter(Boolean);
      if (titleWords.length > 0) {
        parts.push(`(${titleWords.join(' OR ')})`);
      }
      const mandatory = (job.requiredSkills || []).map(quote).filter(Boolean);
      if (mandatory.length > 0) {
        parts.push(`(${mandatory.join(naukriStrictAnd ? ' AND ' : ' OR ')})`);
      }
      baseQuery = parts.join(' AND ');
      if (sourcingPlatform === 'xray') {
        baseQuery = `site:linkedin.com/in ${baseQuery}`;
      }
    }

    // Apply active modifier flags on top of base query
    let modifiedQuery = baseQuery;
    if (includeSeniorityInBoolean && !modifiedQuery.includes('"Senior"') && !modifiedQuery.includes('"Lead"')) {
      modifiedQuery += ' AND ("Lead" OR "Senior" OR "Staff" OR "Principal" OR "Architect")';
    }
    if (includePreferredInBoolean && job.preferredSkills?.length) {
      const preferred = job.preferredSkills.map(quote).filter(Boolean);
      if (preferred.length && !modifiedQuery.includes(preferred[0])) {
        modifiedQuery += ` AND (${preferred.join(' OR ')})`;
      }
    }
    const activeCompanies = selectedCompanies.length > 0 ? selectedCompanies : allCompanies.slice(0, 4);
    if (includeCompaniesInBoolean && activeCompanies.length > 0) {
      const compStr = activeCompanies.map((c) => typeof c === 'string' ? quote(c) : quote(c.name)).filter(Boolean).join(' OR ');
      if (compStr && !modifiedQuery.includes(activeCompanies[0]?.name || activeCompanies[0])) {
        modifiedQuery += ` AND (${compStr})`;
      }
    }
    if (includeLocationInBoolean && job.location && !modifiedQuery.includes(job.location)) {
      const locList = job.location.split(/[\/,]+/).map((l) => l.trim()).filter((l) => l && !/india/i.test(l)).map(quote);
      if (locList.length) {
        modifiedQuery += ` AND (${locList.join(' OR ')})`;
      }
    }
    if (includeNoticeInBoolean && !modifiedQuery.includes('Immediate')) {
      modifiedQuery += ' AND ("Immediate" OR "15 Days" OR "30 Days" OR "Serving Notice")';
    }
    if (includeExclusionsInBoolean && !modifiedQuery.includes('Intern')) {
      modifiedQuery += ' NOT ("Intern" OR "Trainee" OR "Student" OR "Fresher")';
    }
    if (excludedCompanies.length > 0) {
      const excludedQuoted = excludedCompanies.map(quote).filter(Boolean);
      if (excludedQuoted.length > 0) {
        modifiedQuery += ` NOT (${excludedQuoted.join(' OR ')})`;
      }
    }

    return modifiedQuery;
  }, [
    job,
    naukriStrictAnd,
    includePreferredInBoolean,
    includeCompaniesInBoolean,
    includeLocationInBoolean,
    includeNoticeInBoolean,
    includeSeniorityInBoolean,
    includeExclusionsInBoolean,
    sourcingPlatform,
    selectedCompanies,
    excludedCompanies,
    allCompanies,
    searchDepth,
    formattedPlainKeywords,
    generatedQueries,
    keywordDelimiter,
  ]);

  // Active query: user's custom edited string if in Custom Mode, otherwise AI auto-generated.
  const activeBooleanQuery = isCustomMode ? customQueryText : autoBooleanQuery;

  // Derive smart keyword suggestions from backend adjacent skills pipeline
  const suggestedKeywords = useMemo(() => {
    if (!job) return [];
    const queryLower = (activeBooleanQuery || '').toLowerCase();
    const adjacentList = generatedQueries?.adjacent_skills || job.intelligenceData?.adjacent_skills || [];

    return adjacentList.filter((item) => {
      const skillName = typeof item === 'string' ? item : item.skill;
      if (!skillName) return false;
      return !queryLower.includes(skillName.toLowerCase());
    }).slice(0, 10);
  }, [job, activeBooleanQuery, generatedQueries]);

  // Dynamically find relatable stored JDs based on active query tokens and tech stack
  const relatableJDs = useMemo(() => {
    if (!allJobs || allJobs.length <= 1) return [];

    const rawTokens = (activeBooleanQuery || '')
      .replace(/(\bAND\b|\bOR\b|\bNOT\b|site:linkedin\.com\/in|[()"'])/gi, ' ')
      .toLowerCase()
      .split(/\s+/)
      .filter((t) => t.length > 2 && !['with', 'from', 'days', 'notice', 'years', 'lead', 'only', 'any'].includes(t));

    const tokenSet = new Set(rawTokens);

    return allJobs
      .filter((otherJob) => otherJob.id !== job?.id)
      .map((otherJob) => {
        const otherHaystack = [
          otherJob.title || '',
          otherJob.department || '',
          ...(otherJob.requiredSkills || []),
          ...(otherJob.preferredSkills || []),
          otherJob.description || '',
        ].join(' ').toLowerCase();

        let matchCount = 0;
        const matchedSkills = [];

        (otherJob.requiredSkills || []).forEach((sk) => {
          if (tokenSet.has(sk.toLowerCase()) || (activeBooleanQuery || '').toLowerCase().includes(sk.toLowerCase())) {
            matchCount += 3;
            if (!matchedSkills.includes(sk)) matchedSkills.push(sk);
          }
        });

        tokenSet.forEach((t) => {
          if (otherHaystack.includes(t)) {
            matchCount += 1;
          }
        });

        const totalPossible = Math.max(tokenSet.size + (otherJob.requiredSkills?.length || 1), 6);
        const relevanceScore = Math.min(96, Math.max(38, Math.round((matchCount / totalPossible) * 100)));

        return {
          otherJob,
          relevanceScore,
          matchedSkills: matchedSkills.slice(0, 4),
        };
      })
      .filter((item) => item.relevanceScore >= 45 || item.matchedSkills.length > 0)
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, 3);
  }, [allJobs, job?.id, activeBooleanQuery]);

  // Append a single recommended keyword or structured adjacent skill to the query
  const handleAddKeywordToQuery = (kwOrItem) => {
    const keyword = typeof kwOrItem === 'string' ? kwOrItem : kwOrItem?.skill;
    if (!keyword) return;
    const formatted = /\s|[\/\-+&]/.test(keyword) ? `"${keyword}"` : keyword;
    const snippet = ` AND ${formatted}`;
    if (!isCustomMode) {
      setCustomQueryText(activeBooleanQuery ? `${activeBooleanQuery}${snippet}` : formatted);
      setIsCustomMode(true);
    } else {
      handleInsertOperator(snippet);
    }
  };

  // Append all top suggested keywords to the query
  const handleAddAllSuggestedKeywords = () => {
    if (!suggestedKeywords.length) return;
    const additions = suggestedKeywords
      .map((item) => {
        const k = typeof item === 'string' ? item : item?.skill;
        return /\s|[\/\-+&]/.test(k) ? `"${k}"` : k;
      })
      .filter(Boolean)
      .join(' AND ');
    if (!additions) return;
    const snippet = ` AND (${additions})`;
    if (!isCustomMode) {
      setCustomQueryText(activeBooleanQuery ? `${activeBooleanQuery}${snippet}` : additions);
      setIsCustomMode(true);
    } else {
      handleInsertOperator(snippet);
    }
  };

  // Merge unique skills from a relatable stored JD into the current query
  const handleMergeJDSkills = (otherJob) => {
    const candidateSkills = [
      ...(otherJob.requiredSkills || []),
      ...(otherJob.preferredSkills || []),
    ];
    const queryLower = (activeBooleanQuery || '').toLowerCase();
    const newSkills = candidateSkills.filter(
      (s) => !queryLower.includes(s.toLowerCase())
    );
    if (newSkills.length === 0) return;

    const formatted = newSkills
      .slice(0, 4)
      .map((k) => (/\s|[\/\-+&]/.test(k) ? `"${k}"` : k))
      .join(' OR ');

    const snippet = ` AND (${formatted})`;
    if (!isCustomMode) {
      setCustomQueryText(`${activeBooleanQuery}${snippet}`);
      setIsCustomMode(true);
    } else {
      handleInsertOperator(snippet);
    }
  };

  // Toggle Custom Query Mode
  const handleToggleCustomMode = () => {
    if (!isCustomMode) {
      setCustomQueryText(autoBooleanQuery);
      setIsCustomMode(true);
      setTimeout(() => queryInputRef.current?.focus(), 50);
    } else {
      setIsCustomMode(false);
    }
  };

  // Revert custom query back to AI auto-generated
  const handleResetToAutoQuery = () => {
    setCustomQueryText(autoBooleanQuery);
    setIsCustomMode(false);
  };

  // Insert Boolean operators or syntax tokens into textarea at caret position
  const handleInsertOperator = (snippet) => {
    if (!isCustomMode) {
      setCustomQueryText(autoBooleanQuery);
      setIsCustomMode(true);
    }
    const textarea = queryInputRef.current;
    if (!textarea) {
      setCustomQueryText((prev) => (prev ? `${prev} ${snippet}` : snippet));
      return;
    }
    const start = textarea.selectionStart ?? textarea.value.length;
    const end = textarea.selectionEnd ?? textarea.value.length;
    const current = textarea.value;
    const updated = current.slice(0, start) + snippet + current.slice(end);
    setCustomQueryText(updated);
    setTimeout(() => {
      textarea.focus();
      const newPos = start + snippet.length;
      textarea.setSelectionRange(newPos, newPos);
    }, 0);
  };

  const handleToggleCompany = (companyName) => {
    setSelectedCompanies((prev) =>
      prev.includes(companyName) ? prev.filter((c) => c !== companyName) : [...prev, companyName]
    );
    setExcludedCompanies((prev) => prev.filter((c) => c !== companyName));
    if (!includeCompaniesInBoolean) setIncludeCompaniesInBoolean(true);
  };

  const handleToggleExcludeCompany = (companyName) => {
    setExcludedCompanies((prev) =>
      prev.includes(companyName) ? prev.filter((c) => c !== companyName) : [...prev, companyName]
    );
    setSelectedCompanies((prev) => prev.filter((c) => c !== companyName));
  };

  const handleSelectCategoryCompanies = (catId) => {
    const pool = catId === 'all'
      ? filteredCompanyObjects
      : filteredCompanyObjects.filter((c) => c.category === catId);
    const names = pool.map((c) => c.name);
    setSelectedCompanies((prev) => {
      const merged = new Set([...prev, ...names]);
      return Array.from(merged);
    });
    setExcludedCompanies((prev) => prev.filter((c) => !names.includes(c)));
    if (!includeCompaniesInBoolean) setIncludeCompaniesInBoolean(true);
  };

  const handleExcludeCategoryCompanies = (catId) => {
    const pool = catId === 'all'
      ? filteredCompanyObjects
      : filteredCompanyObjects.filter((c) => c.category === catId);
    const names = pool.map((c) => c.name);
    setExcludedCompanies((prev) => {
      const merged = new Set([...prev, ...names]);
      return Array.from(merged);
    });
    setSelectedCompanies((prev) => prev.filter((c) => !names.includes(c)));
  };

  const handleSelectAllCompanies = () => {
    setSelectedCompanies([...allCompanies]);
    setExcludedCompanies([]);
    if (!includeCompaniesInBoolean) setIncludeCompaniesInBoolean(true);
  };

  const handleClearSelectedCompanies = () => {
    setSelectedCompanies([]);
  };

  const handleClearExcludedCompanies = () => {
    setExcludedCompanies([]);
  };

  const handleAddCustomCompany = (e) => {
    e?.preventDefault();
    const trimmed = customCompanyInput.trim();
    if (!trimmed) return;

    const exists = allCompanyObjects.some(
      (c) => c.name.toLowerCase() === trimmed.toLowerCase()
    );

    if (!exists) {
      const newObj = {
        name: trimmed,
        category: customCompanyCategory || 'gsi',
        tier: 'Custom Account',
        location: customCompanyLocation.trim() || job?.location || 'India',
        description: 'Recruiter added custom company for talent sourcing or exclusion',
      };
      setCustomCompanies((prev) => [...prev, newObj]);
    }

    // Auto-select as target
    setSelectedCompanies((prev) => (prev.includes(trimmed) ? prev : [...prev, trimmed]));
    setExcludedCompanies((prev) => prev.filter((c) => c.toLowerCase() !== trimmed.toLowerCase()));
    if (!includeCompaniesInBoolean) setIncludeCompaniesInBoolean(true);

    setCustomCompanyInput('');
    setCustomCompanyLocation('');
    setShowAddCompanyInput(false);
    setShowMarketReportModal(false);
  };

  const handleRemoveCustomCompany = (companyName, e) => {
    e?.stopPropagation();
    setCustomCompanies((prev) => prev.filter((c) => c.name.toLowerCase() !== companyName.toLowerCase()));
    setSelectedCompanies((prev) => prev.filter((c) => c !== companyName));
    setExcludedCompanies((prev) => prev.filter((c) => c !== companyName));
  };

  const handleExportCompaniesExcel = (exportOnlyFiltered = false) => {
    const listToExport = exportOnlyFiltered ? filteredCompanyObjects : allCompanyObjects;
    if (!listToExport || listToExport.length === 0) return;

    const jobTitle = job?.title || 'Requisition';
    const jobCode = job?.job_code || (job?.id ? `Job #${job.id}` : 'Job');
    const jobLocation = job?.location || 'India / Remote';
    const ecosystemName = targetCompaniesData?.ecosystem_name || (job?.title ? `${job.title} Sourcing Ecosystem` : 'Corporate Sourcing Ecosystem');
    const strategyName = targetCompaniesData?.primary_strategy || 'Direct Industry Experience';
    const strategyRationale = targetCompaniesData?.strategy_rationale || 'Target leading platform partners, engineering consultancies, and enterprise GCCs.';
    const dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

    const categoryMap = {
      product: 'Product & OEMs',
      oem: 'Product & OEMs',
      gsi: 'Global System Integrators',
      big4: 'Big 4 & Advisory',
      advisory: 'Big 4 & Advisory',
      agency: 'Advertising & Creative Studios',
      retail: 'Retail & E-Commerce Hubs',
      gcc: 'Enterprise GCCs & Hubs',
    };

    let tableRows = '';
    listToExport.forEach((co, idx) => {
      let status = 'Suggested';
      let statusBg = '#EEF2FF';
      let statusColor = '#3730A3';
      if (selectedCompanies.includes(co.name)) {
        status = 'Targeted';
        statusBg = '#DCFCE7';
        statusColor = '#166534';
      } else if (excludedCompanies.includes(co.name)) {
        status = 'Off-Limits';
        statusBg = '#FFE4E6';
        statusColor = '#9F1239';
      }

      const catLabel = categoryMap[co.category] || co.category || 'General';
      const tierLvl = co.tier_level || (co.tier?.toLowerCase().includes('tier 1') || co.tier?.toLowerCase().includes('tier-1') || co.category === 'oem' || co.category === 'gcc' ? 'Tier 1' : (co.tier?.toLowerCase().includes('tier 2') || co.tier?.toLowerCase().includes('tier-2') ? 'Tier 2' : 'Tier 3'));
      const tierColor = tierLvl.includes('1') ? '#4338CA' : (tierLvl.includes('2') ? '#0284C7' : '#7C3AED');
      let skillsStr = Array.isArray(co.overlap_skills) && co.overlap_skills.length > 0 ? co.overlap_skills.join(', ') : '';
      if (!skillsStr) {
        const reqs = job?.requiredSkills || [];
        if (reqs.length > 0) {
          const offset = (idx * 2) % reqs.length;
          const rotated = [...reqs.slice(offset), ...reqs.slice(0, offset)];
          skillsStr = rotated.slice(0, 3).join(', ');
        } else {
          skillsStr = `${co.name} Core Competencies`;
        }
      }
      const reasonStr = co.why_recommended || co.recommendation_reason || co.reason || `${tierLvl} sourcing target ${co.name} maintains proven capability in ${skillsStr} for ${jobTitle} hiring.`;
      const overviewStr = co.description || '';
      const rowBg = idx % 2 === 0 ? '#FFFFFF' : '#F8FAFC';

      tableRows += `
        <tr style="background-color: ${rowBg}; height: 26pt;">
          <td style="border: 1px solid #CBD5E1; text-align: center; font-weight: bold; color: #64748B; font-size: 10pt;">${idx + 1}</td>
          <td style="border: 1px solid #CBD5E1; font-weight: bold; color: #0F172A; font-size: 10.5pt; padding: 6px 10px;">${co.name}</td>
          <td style="border: 1px solid #CBD5E1; color: #334155; font-size: 10pt; padding: 6px 10px;">${catLabel}</td>
          <td style="border: 1px solid #CBD5E1; text-align: center; font-weight: bold; color: ${tierColor}; font-size: 10pt; padding: 6px 8px;">${tierLvl}</td>
          <td style="border: 1px solid #CBD5E1; color: #475569; font-size: 10pt; padding: 6px 10px;">${co.tier || 'Industry Peer'}</td>
          <td style="border: 1px solid #CBD5E1; color: #334155; font-size: 10pt; padding: 6px 10px;">${co.location || jobLocation}</td>
          <td style="border: 1px solid #CBD5E1; text-align: center; padding: 6px 10px;">
            <span style="background-color: ${statusBg}; color: ${statusColor}; font-weight: bold; font-size: 9.5pt; padding: 3px 8px; border-radius: 4px;">
              ${status}
            </span>
          </td>
          <td style="border: 1px solid #CBD5E1; text-align: center; font-size: 10pt; font-weight: bold; color: #047857;">${co.confidence || 'High'}</td>
          <td style="border: 1px solid #CBD5E1; color: #1E293B; font-size: 10pt; padding: 6px 10px;">${skillsStr}</td>
          <td style="border: 1px solid #CBD5E1; color: #334155; font-size: 9.5pt; padding: 6px 10px; line-height: 1.35;">${reasonStr}</td>
          <td style="border: 1px solid #CBD5E1; color: #475569; font-size: 9.5pt; padding: 6px 10px; line-height: 1.35;">${overviewStr}</td>
        </tr>
      `;
    });

    const htmlContent = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta http-equiv="Content-Type" content="text/html; charset=utf-8">
        <!--[if gte mso 9]>
        <xml>
          <x:ExcelWorkbook>
            <x:ExcelWorksheets>
              <x:ExcelWorksheet>
                <x:Name>Target Sourcing Pools</x:Name>
                <x:WorksheetOptions>
                  <x:DisplayGridlines/>
                  <x:FreezePanes/>
                  <x:FrozenNoSplit/>
                  <x:SplitHorizontal>6</x:SplitHorizontal>
                  <x:TopRowBottomPane>6</x:TopRowBottomPane>
                  <x:ActivePane>2</x:ActivePane>
                  <x:AutoFilter x:Range="A6:K6"/>
                </x:WorksheetOptions>
              </x:ExcelWorksheet>
            </x:ExcelWorksheets>
          </x:ExcelWorkbook>
        </xml>
        <![endif]-->
        <style>
          body { font-family: Calibri, 'Segoe UI', Arial, sans-serif; }
          table { border-collapse: collapse; width: 100%; }
          th { font-family: Calibri, 'Segoe UI', Arial, sans-serif; }
          td { font-family: Calibri, 'Segoe UI', Arial, sans-serif; vertical-align: middle; }
        </style>
      </head>
      <body>
        <table>
          <!-- 1. Executive Title Banner -->
          <tr style="height: 34pt;">
            <th colspan="11" style="background-color: #1E293B; color: #FFFFFF; font-size: 15pt; font-weight: bold; text-align: left; padding: 8px 14px; border: 1px solid #0F172A;">
              TALENT SOURCING INTELLIGENCE &bull; TARGET COMPANIES SPREADSHEET
            </th>
          </tr>

          <!-- 2. Requisition Metadata Bar -->
          <tr style="height: 22pt;">
            <td colspan="11" style="background-color: #F1F5F9; color: #0F172A; font-size: 11pt; font-weight: bold; padding: 5px 14px; border: 1px solid #CBD5E1;">
              Position: <span style="color: #4338CA;">${jobTitle}</span> &nbsp;|&nbsp; 
              Requisition Code: <span style="color: #475569;">${jobCode}</span> &nbsp;|&nbsp; 
              Target Location: <span style="color: #475569;">${jobLocation}</span> &nbsp;|&nbsp; 
              Export Date: <span style="color: #475569;">${dateStr}</span>
            </td>
          </tr>

          <!-- 3. Sourcing Strategy Bar -->
          <tr style="height: 22pt;">
            <td colspan="11" style="background-color: #F8FAFC; color: #334155; font-size: 10.5pt; padding: 5px 14px; border: 1px solid #CBD5E1;">
              Corporate Sourcing Ecosystem: <strong>${ecosystemName}</strong> &nbsp;|&nbsp; 
              Recommended Headhunting Strategy: <strong>${strategyName}</strong>
            </td>
          </tr>

          <!-- 4. Strategy Rationale -->
          <tr style="height: 20pt;">
            <td colspan="11" style="background-color: #FFFFFF; color: #64748B; font-size: 9.5pt; font-style: italic; padding: 4px 14px; border: 1px solid #CBD5E1;">
              Strategy Rationale: ${strategyRationale} &nbsp;&bull;&nbsp; Total Target Companies: ${listToExport.length}
            </td>
          </tr>

          <!-- 5. Blank Separator -->
          <tr style="height: 6pt;"><td colspan="11" style="background-color: #FFFFFF; border: none;"></td></tr>

          <!-- 6. Stylized Column Headings (Frozen at top with AutoFilter) -->
          <tr style="background-color: #0F172A; color: #FFFFFF; height: 32pt; font-size: 11pt;" x:autofilter="all">
            <th style="border: 1px solid #334155; padding: 8px 6px; width: 45px; text-align: center;">#</th>
            <th style="border: 1px solid #334155; padding: 8px 12px; width: 230px; text-align: left;">Target Company</th>
            <th style="border: 1px solid #334155; padding: 8px 12px; width: 170px; text-align: left;">Category</th>
            <th style="border: 1px solid #334155; padding: 8px 10px; width: 100px; text-align: center;">Tier Level</th>
            <th style="border: 1px solid #334155; padding: 8px 12px; width: 220px; text-align: left;">Tier & Focus</th>
            <th style="border: 1px solid #334155; padding: 8px 12px; width: 180px; text-align: left;">Target Locations</th>
            <th style="border: 1px solid #334155; padding: 8px 12px; width: 130px; text-align: center;">Sourcing Status</th>
            <th style="border: 1px solid #334155; padding: 8px 10px; width: 100px; text-align: center;">Confidence</th>
            <th style="border: 1px solid #334155; padding: 8px 12px; width: 250px; text-align: left;">JD Overlap Skills</th>
            <th style="border: 1px solid #334155; padding: 8px 12px; width: 340px; text-align: left;">Why Recommended / Headhunting Strategy</th>
            <th style="border: 1px solid #334155; padding: 8px 12px; width: 340px; text-align: left;">Company Overview</th>
          </tr>

          <!-- 7. Data Rows -->
          ${tableRows}
        </table>
      </body>
      </html>
    `;

    const blob = new Blob([htmlContent], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const sanitizedJobTitle = (job?.title || 'Job').replace(/[^a-zA-Z0-9_-]/g, '_');
    const fileDate = new Date().toISOString().split('T')[0];
    link.href = url;
    link.setAttribute('download', `Target_Companies_${sanitizedJobTitle}_${fileDate}.xls`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleExportCompaniesCSV = (exportOnlyFiltered = false) => {
    const listToExport = exportOnlyFiltered ? filteredCompanyObjects : allCompanyObjects;
    if (!listToExport || listToExport.length === 0) return;

    const escapeCsv = (val) => {
      if (val === null || val === undefined) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    const headers = [
      '#',
      'Company Name',
      'Category',
      'Tier Level',
      'Tier & Focus',
      'Target Locations',
      'Sourcing Status',
      'Confidence',
      'JD Overlap Skills',
      'Why Recommended / Headhunting Strategy',
      'Company Overview',
      'Corporate Sourcing Ecosystem',
      'Requisition / Job Title',
      'Job Code',
    ];

    const categoryMap = {
      product: 'Product & OEMs',
      oem: 'Product & OEMs',
      gsi: 'Global System Integrators',
      big4: 'Big 4 & Advisory',
      advisory: 'Big 4 & Advisory',
      agency: 'Advertising & Creative Studios',
      retail: 'Retail & E-Commerce Hubs',
      gcc: 'Enterprise GCCs & Hubs',
    };

    const rows = listToExport.map((co, idx) => {
      let status = 'Suggested';
      if (selectedCompanies.includes(co.name)) {
        status = 'Targeted';
      } else if (excludedCompanies.includes(co.name)) {
        status = 'Off-Limits';
      }

      const catLabel = categoryMap[co.category] || co.category || 'General';
      const tierLvl = co.tier_level || (co.tier?.toLowerCase().includes('tier 1') || co.tier?.toLowerCase().includes('tier-1') || co.category === 'oem' || co.category === 'gcc' ? 'Tier 1' : (co.tier?.toLowerCase().includes('tier 2') || co.tier?.toLowerCase().includes('tier-2') ? 'Tier 2' : 'Tier 3'));
      let skillsStr = Array.isArray(co.overlap_skills) && co.overlap_skills.length > 0 ? co.overlap_skills.join(', ') : '';
      if (!skillsStr) {
        const reqs = job?.requiredSkills || [];
        if (reqs.length > 0) {
          const offset = (idx * 2) % reqs.length;
          const rotated = [...reqs.slice(offset), ...reqs.slice(0, offset)];
          skillsStr = rotated.slice(0, 3).join(', ');
        } else {
          skillsStr = `${co.name} Core Competencies`;
        }
      }
      const reasonStr = co.why_recommended || co.recommendation_reason || co.reason || `${tierLvl} sourcing target ${co.name} maintains proven capability in ${skillsStr} for ${jobTitle} hiring.`;
      const ecosystemNameStr = targetCompaniesData?.ecosystem_name || co.ecosystemName || (job?.title ? `${job.title} Sourcing Ecosystem` : 'Corporate Sourcing Ecosystem');

      return [
        escapeCsv(idx + 1),
        escapeCsv(co.name),
        escapeCsv(catLabel),
        escapeCsv(tierLvl),
        escapeCsv(co.tier || 'Industry Peer'),
        escapeCsv(co.location || job?.location || 'India / Remote'),
        escapeCsv(status),
        escapeCsv(co.confidence || 'High'),
        escapeCsv(skillsStr),
        escapeCsv(reasonStr),
        escapeCsv(co.description || ''),
        escapeCsv(ecosystemNameStr),
        escapeCsv(job?.title || 'Job Requisition'),
        escapeCsv(job?.job_code || job?.id || ''),
      ].join(',');
    });

    // Prepend UTF-8 BOM so Excel opens with proper character encoding
    const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const sanitizedJobTitle = (job?.title || 'Job').replace(/[^a-zA-Z0-9_-]/g, '_');
    const dateStr = new Date().toISOString().split('T')[0];
    link.href = url;
    link.setAttribute('download', `Target_Companies_${sanitizedJobTitle}_${dateStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleExportCompaniesDocument = async (format) => {
    if (!job?.id) return;
    const jobIdParam = job.numeric_id || job.id;
    const apiBase = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api';
    const ext = format === 'word' ? 'docx' : 'pdf';
    try {
      const response = await fetch(`${apiBase}/jobs/${encodeURIComponent(jobIdParam)}/target-companies/${format}`);
      if (!response.ok) {
        throw new Error(`Export failed (${response.status})`);
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const sanitizedJobTitle = (job?.title || 'Job').replace(/[^a-zA-Z0-9_-]/g, '_');
      const dateStr = new Date().toISOString().split('T')[0];
      link.href = url;
      link.setAttribute('download', `Target_Companies_${sanitizedJobTitle}_${dateStr}.${ext}`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      setTargetCompaniesError(err?.message || `Failed to export ${format.toUpperCase()} report`);
    }
  };

  const handleBulkActionSelect = (actionVal) => {
    if (!actionVal) return;
    if (actionVal === 'target_tab') {
      handleSelectCategoryCompanies(companyCategoryFilter);
    } else if (actionVal === 'exclude_tab') {
      handleExcludeCategoryCompanies(companyCategoryFilter);
    } else if (actionVal === 'target_all') {
      handleSelectAllCompanies();
    } else if (actionVal === 'clear_targets') {
      handleClearSelectedCompanies();
    } else if (actionVal === 'clear_excluded') {
      handleClearExcludedCompanies();
    } else if (actionVal === 'export_excel') {
      handleExportCompaniesExcel(false);
    } else if (actionVal === 'export_view_excel') {
      handleExportCompaniesExcel(true);
    } else if (actionVal === 'export_csv') {
      handleExportCompaniesCSV(false);
    } else if (actionVal === 'export_view_csv') {
      handleExportCompaniesCSV(true);
    } else if (actionVal === 'export_pdf') {
      handleExportCompaniesDocument('pdf');
    } else if (actionVal === 'export_word') {
      handleExportCompaniesDocument('word');
    }
  };

  const handleCopyTargetClause = async () => {
    const list = selectedCompanies.length > 0 ? selectedCompanies : allCompanies.slice(0, 4);
    if (!list.length) return;
    const clause = `(${list.map((c) => `"${c}"`).join(' OR ')})`;
    try {
      await navigator.clipboard.writeText(clause);
      setCopiedTargetClause(true);
      setTimeout(() => setCopiedTargetClause(false), 2000);
    } catch {}
  };

  const handleCopyExcludedClause = async () => {
    if (!excludedCompanies.length) return;
    const clause = `NOT (${excludedCompanies.map((c) => `"${c}"`).join(' OR ')})`;
    try {
      await navigator.clipboard.writeText(clause);
      setCopiedExcludedClause(true);
      setTimeout(() => setCopiedExcludedClause(false), 2000);
    } catch {}
  };

  const handleCopyBoolean = async (specificText) => {
    const textToCopy = specificText || activeBooleanQuery;
    if (!textToCopy) return;
    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopiedBoolean(true);
      setTimeout(() => setCopiedBoolean(false), 2000);
    } catch {
      // Clipboard fallback omitted in restricted contexts.
    }
  };

  const handleCopyOriginalSource = async () => {
    const text = job?.originalText || job?.description;
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedOriginalSource(true);
      setTimeout(() => setCopiedOriginalSource(false), 2000);
    } catch {
      // Clipboard fallback omitted in restricted contexts.
    }
  };

  const handleSaveBooleanSearch = async () => {
    if (!job || !activeBooleanQuery) return;
    try {
      await jobApi.saveBooleanSearch(job.numeric_id || job.id, {
        platform: sourcingPlatform,
        search_mode: searchDepth,
        query_text: activeBooleanQuery,
      });
      const rows = await jobApi.getBooleanSearchHistory(job.numeric_id || job.id);
      setSearchHistory(Array.isArray(rows) ? rows : []);
    } catch (error) {
      setMatchError(String(error?.message || 'Failed to save Boolean search'));
    }
  };

  const handleLaunchSearch = () => {
    if (!activeBooleanQuery) return;
    let url = '';
    if (sourcingPlatform === 'xray') {
      url = `https://www.google.com/search?q=${encodeURIComponent(activeBooleanQuery)}`;
    } else if (sourcingPlatform === 'linkedin') {
      url = `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(activeBooleanQuery)}`;
    } else {
      url = `https://www.google.com/search?q=${encodeURIComponent('site:naukri.com ' + activeBooleanQuery)}`;
    }
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  // Filter candidates: search matching candidates pool + fall back/expand to database talent pool
  const filteredMatchingCandidates = useMemo(() => {
    const rawTerm = (candidateKeywordFilter || '').trim();
    if (!rawTerm) return matchingCandidates;

    const term = rawTerm.toLowerCase();
    // Split on whitespace or commas to support queries like "Oracle EPM", "Oracle, Hyperion", etc.
    const tokens = term.split(/[\s,]+/).filter(Boolean);

    const matchesCandidate = (c) => {
      const skillsStr = [
        ...(c.primarySkills || []),
        ...(c.secondarySkills || []),
        ...(c.skills || []),
      ].join(' ');

      const haystack = [
        c.name || '',
        c.candidate_name || '',
        c.currentRole || c.title || '',
        c.location || '',
        c.summary || '',
        c.email || '',
        skillsStr,
        ...(c.evidenceHighlights || []),
      ]
        .join(' ')
        .toLowerCase();

      // Check for exact substring match or all tokens matched
      return haystack.includes(term) || (tokens.length > 0 && tokens.every((tok) => haystack.includes(tok)));
    };

    // 1. Filter candidates within the evaluated job match pool
    const matchedInJobPool = (matchingCandidates || []).filter(matchesCandidate);

    // 2. Also search all candidates in our database talent pool so searching e.g. "Oracle" finds all DB candidates
    const evaluatedIds = new Set(
      (matchingCandidates || []).map((c) => String(c.numeric_id || c.id || c.candidate_id))
    );

    const extraFromDb = (allCandidates || [])
      .filter((c) => !evaluatedIds.has(String(c.numeric_id || c.id)))
      .filter(matchesCandidate)
      .map((c) => ({
        ...c,
        id: c.numeric_id || c.id,
        currentRole: c.currentRole || c.title || 'Candidate Profile',
        matchScore: c.matchScore ?? null,
        classification: c.classification || 'Talent Pool Match',
        sourceTag: 'Database Talent Pool',
      }));

    return [...matchedInJobPool, ...extraFromDb];
  }, [matchingCandidates, allCandidates, candidateKeywordFilter]);

  // If no job is selected, show placeholder instruction.
  if (!job) {
    return (
      <div className="p-12 bg-white dark:bg-surface-darkCard border border-slate-200/80 dark:border-surface-darkBorder rounded-2xl shadow-card text-center text-slate-400">
        <Briefcase className="w-8 h-8 mx-auto mb-2 text-slate-300 stroke-[1.5]" />
        <p className="text-sm font-medium text-navy-900 dark:text-slate-100">Select a Job Description</p>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Click any job on the left to inspect requirements, AI analysis, and matched applicants.
        </p>
      </div>
    );
  }

  // Include Open alongside Active and Under Review to match real SQLite job status distribution.
  const jobStatusOptions = ['Active', 'Open', 'Under Review', 'Draft', 'On Hold', 'Closed'];

  // Normalize job status string for dropdown matching.
  const normalizedJobStatus =
    jobStatusOptions.find((opt) => opt.toLowerCase() === (job.status || '').trim().toLowerCase()) ||
    job.status ||
    'Active';

  // Helper to style job status badge dropdown.
  const getJobStatusStyle = (status) => {
    switch ((status || '').toLowerCase()) {
      case 'active':
        return 'bg-brand-50 dark:bg-brand-950/50 text-brand-700 dark:text-brand-300 border-brand-200 dark:border-brand-800';
      case 'open':
        return 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800';
      case 'under review':
        return 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800';
      case 'closed':
        return 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700';
      default:
        return 'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800';
    }
  };

  // Propose human-in-the-loop JD segmentation / publishing approval.
  const handleProposeJobApproval = async () => {
    setApprovalSentMsg('');
    try {
      await approvalApi.propose({
        action_type: 'approve_jd_segmentation',
        description: `Approve JD specification & matching criteria for ${job.title}`,
        payload: { job_id: job.numeric_id || job.id, job_title: job.title, version: job.version || 1 },
        requester: 'Krishna C. (Recruiter)',
      });
      setApprovalSentMsg('JD approval request submitted to Approvals Queue.');
      if (onRefreshApprovals) {
        await onRefreshApprovals();
      }
    } catch (err) {
      setApprovalSentMsg(`Submission failed: ${err.message}`);
    }
  };

  const handleOpenEditJD = () => {
    setJdEditForm({
      title: job.title || '',
      department: job.department || '',
      location: job.location === 'Not specified' ? '' : (job.location || ''),
      minYears: job.minYears != null ? String(job.minYears) : '',
      maxYears: job.maxYears != null ? String(job.maxYears) : '',
      requiredSkillsText: (job.requiredSkills || []).join(', '),
      preferredSkillsText: (job.preferredSkills || []).join(', '),
      description: job.description || job.originalText || '',
    });
    setJdEditError('');
    setIsEditingJD(true);
  };

  const handleSaveJD = async (e) => {
    e.preventDefault();
    if (!onUpdateJob) return;
    const trimmedTitle = jdEditForm.title.trim();
    if (!trimmedTitle) {
      setJdEditError('Job title is required.');
      return;
    }
    const minY = jdEditForm.minYears === '' ? null : Number(jdEditForm.minYears);
    const maxY = jdEditForm.maxYears === '' ? null : Number(jdEditForm.maxYears);
    if ((minY !== null && Number.isNaN(minY)) || (maxY !== null && Number.isNaN(maxY))) {
      setJdEditError('Experience years must be valid numbers.');
      return;
    }
    if (minY !== null && maxY !== null && minY > maxY) {
      setJdEditError('Minimum experience cannot exceed maximum experience.');
      return;
    }

    const parseSkills = (text) =>
      text
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

    setIsSavingJD(true);
    setJdEditError('');
    try {
      await onUpdateJob({
        ...job,
        title: trimmedTitle,
        department: jdEditForm.department.trim(),
        location: jdEditForm.location.trim(),
        minYears: minY,
        maxYears: maxY,
        requiredSkills: parseSkills(jdEditForm.requiredSkillsText),
        preferredSkills: parseSkills(jdEditForm.preferredSkillsText),
        description: jdEditForm.description,
      });
      setIsEditingJD(false);
    } catch (err) {
      setJdEditError(err?.message || 'Failed to save job description changes.');
    } finally {
      setIsSavingJD(false);
    }
  };

  // Track JD-synced vs recruiter-added provenance cleanly.
  const syncedMandatorySet = new Set(job.syncedMandatorySkills || []);

  // Render job detail view.
  const jobDetailCardClassName =
    'bg-white dark:bg-surface-darkCard border border-slate-200/80 dark:border-surface-darkBorder rounded-2xl shadow-card p-6 space-y-6';

  // The top area with the job title, status, and action buttons.
  const jobHeaderClassName =
    'flex flex-col gap-4 pb-5 border-b border-slate-100 dark:border-surface-darkBorder';

  return (
    <div className={jobDetailCardClassName}>
      {/* Header section with title, customizable status dropdown, and action triggers */}
      <div className={jobHeaderClassName}>
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className="font-mono text-xs font-semibold text-slate-500 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2.5 py-0.5 rounded border border-slate-200 dark:border-slate-700">
              {job.jdCode}
            </span>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-950/50 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
              v{job.version || 1}
            </span>
            {job.ocrNeeded && (
              <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                OCR Required
              </span>
            )}
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">{job.department}</span>

            {/* Interactive Job Status Dropdown */}
            <div className="relative inline-block ml-1">
              <CustomSelect
                value={normalizedJobStatus}
                onChange={(nextStatus) => {
                  if (onUpdateJob) {
                    onUpdateJob({ ...job, status: nextStatus });
                  }
                }}
                ariaLabel={`Status for ${job.title}`}
                size="sm"
                buttonClassName={`!py-1 !px-2.5 !rounded-lg !text-[13px] !font-semibold ${getJobStatusStyle(
                  normalizedJobStatus
                )}`}
                options={jobStatusOptions.map((opt) => ({ value: opt, label: opt }))}
              />
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <h2 className="text-xl sm:text-2xl font-bold text-navy-900 dark:text-slate-100 tracking-tight">{job.title}</h2>
            <button
              type="button"
              onClick={() => (onEditJob ? onEditJob(job) : handleOpenEditJD())}
              className="p-1.5 rounded-xl text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 border border-transparent hover:border-indigo-200 dark:border-indigo-800 transition-all cursor-pointer"
              title="Edit Job Title & Specifications"
              aria-label="Edit Job Title & Specifications"
            >
              <Edit3 className="w-4 h-4" />
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400 mt-2">
            <span className="flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-slate-400" />
              {job.location || 'Location not specified'}
            </span>
            <span className="flex items-center gap-1.5">
              <Briefcase className="w-3.5 h-3.5 text-slate-400" />
              {job.experienceRequired}
            </span>
            {job.sourceFilename && (
              <span className="flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-slate-400" />
                {job.sourceFilename}
              </span>
            )}
          </div>
        </div>

        {/* Action Button Group (wraps cleanly inside card bounds) */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => onOpenMatrix?.(job)}
            className="flex items-center justify-center gap-2 px-3.5 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-all hover-lift"
          >
            <Users className="w-4 h-4 text-white" />
            <span>Find Candidates</span>
          </button>

          <button
            onClick={() => onOpenSegmentation?.(job)}
            className="flex items-center justify-center gap-2 px-3.5 py-2 bg-navy-900 dark:bg-slate-800 hover:bg-navy-950 text-white rounded-xl text-xs font-semibold shadow-sm transition-all hover-lift"
          >
            <Sparkles className="w-4 h-4 text-brand-300" />
            <span>Role Requirements</span>
          </button>

          {onOpenComparison && (
            <button
              onClick={() => onOpenComparison?.()}
              className="flex items-center justify-center gap-2 px-3.5 py-2 bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 text-indigo-700 dark:text-indigo-300 border border-indigo-200/90 dark:border-indigo-800 rounded-xl text-xs font-semibold shadow-subtle transition-all hover-lift"
              title="Open deep side-by-side JD and Resume Comparison"
            >
              <GitCompare className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <span>Match with Resume</span>
            </button>
          )}

          <button
            onClick={() => onAnalyzeJob(job)}
            className="flex items-center justify-center gap-2 px-3.5 py-2 bg-brand-50 dark:bg-brand-950/40 hover:bg-brand-100 text-brand-700 dark:text-brand-300 border border-brand-200/90 dark:border-brand-800 rounded-xl text-xs font-semibold shadow-subtle transition-all hover-lift"
          >
            <Sparkles className="w-4 h-4 text-brand-600 dark:text-brand-400" />
            <span>AI Review</span>
          </button>

          <button
            type="button"
            onClick={handleProposeJobApproval}
            className="flex items-center justify-center gap-1.5 px-3 py-2 bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 rounded-xl text-xs font-semibold transition-all hover-lift"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Submit for Approval</span>
          </button>

          <button
            type="button"
            onClick={() => (onEditJob ? onEditJob(job) : (isEditingJD ? setIsEditingJD(false) : handleOpenEditJD()))}
            className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-all hover-lift cursor-pointer ${
              isEditingJD
                ? 'bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-100 border-slate-300 dark:border-slate-600'
                : 'bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 text-indigo-700 dark:text-indigo-300 border border-indigo-200/90 dark:border-indigo-800 shadow-subtle'
            }`}
            title="Edit Job Description & Requirements"
          >
            <Edit3 className="w-4 h-4" />
            <span>{isEditingJD ? 'Close Editor' : 'Edit JD'}</span>
          </button>
        </div>
      </div>

      {isEditingJD && (
        <form
          onSubmit={handleSaveJD}
          className="rounded-2xl border border-brand-200/80 dark:border-brand-800/70 bg-slate-50/80 dark:bg-surface-darkBg p-4 sm:p-5 space-y-4 animate-fadeIn"
        >
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-sm font-bold text-navy-950 dark:text-slate-100 flex items-center gap-2">
              <Edit3 className="w-4 h-4 text-brand-600 dark:text-brand-400" />
              <span>Edit Job Description</span>
            </h4>
            <button
              type="button"
              onClick={() => setIsEditingJD(false)}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              aria-label="Close JD editor"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {jdEditError && (
            <div className="px-3 py-2 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs font-medium text-rose-700 dark:text-rose-300">
              {jdEditError}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                Job Title
              </label>
              <input
                type="text"
                value={jdEditForm.title}
                onChange={(e) => setJdEditForm((p) => ({ ...p, title: e.target.value }))}
                className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-surface-darkBorder bg-white dark:bg-surface-darkCard text-navy-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                required
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                Department
              </label>
              <input
                type="text"
                value={jdEditForm.department}
                onChange={(e) => setJdEditForm((p) => ({ ...p, department: e.target.value }))}
                placeholder="Engineering & Delivery"
                className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-surface-darkBorder bg-white dark:bg-surface-darkCard text-navy-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                Location
              </label>
              <input
                type="text"
                value={jdEditForm.location}
                onChange={(e) => setJdEditForm((p) => ({ ...p, location: e.target.value }))}
                placeholder="Bengaluru / Hybrid"
                className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-surface-darkBorder bg-white dark:bg-surface-darkCard text-navy-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                Min Experience (Years)
              </label>
              <input
                type="number"
                min="0"
                max="80"
                step="0.5"
                value={jdEditForm.minYears}
                onChange={(e) => setJdEditForm((p) => ({ ...p, minYears: e.target.value }))}
                placeholder="e.g. 2"
                className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-surface-darkBorder bg-white dark:bg-surface-darkCard text-navy-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                Max Experience (Years)
              </label>
              <input
                type="number"
                min="0"
                max="80"
                step="0.5"
                value={jdEditForm.maxYears}
                onChange={(e) => setJdEditForm((p) => ({ ...p, maxYears: e.target.value }))}
                placeholder="e.g. 5"
                className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-surface-darkBorder bg-white dark:bg-surface-darkCard text-navy-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                Mandatory Skills (comma-separated)
              </label>
              <input
                type="text"
                value={jdEditForm.requiredSkillsText}
                onChange={(e) => setJdEditForm((p) => ({ ...p, requiredSkillsText: e.target.value }))}
                placeholder="Python, SQL, FastAPI"
                className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-surface-darkBorder bg-white dark:bg-surface-darkCard text-navy-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                Preferred Skills (comma-separated)
              </label>
              <input
                type="text"
                value={jdEditForm.preferredSkillsText}
                onChange={(e) => setJdEditForm((p) => ({ ...p, preferredSkillsText: e.target.value }))}
                placeholder="Docker, AWS"
                className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-surface-darkBorder bg-white dark:bg-surface-darkCard text-navy-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
              Job Description
            </label>
            <textarea
              rows={6}
              value={jdEditForm.description}
              onChange={(e) => setJdEditForm((p) => ({ ...p, description: e.target.value }))}
              className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-surface-darkBorder bg-white dark:bg-surface-darkCard text-navy-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500/30 font-mono"
            />
          </div>

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsEditingJD(false)}
              disabled={isSavingJD}
              className="px-3.5 py-2 rounded-xl text-xs font-semibold border border-slate-200 dark:border-surface-darkBorder bg-white dark:bg-surface-darkCard text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSavingJD}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-brand-600 hover:bg-brand-700 text-white shadow-sm disabled:opacity-60"
            >
              {isSavingJD ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              <span>{isSavingJD ? 'Saving...' : 'Save Changes'}</span>
            </button>
          </div>
        </form>
      )}

      {/* 21st.dev inspired Recruiter Quick Sourcing Hub */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 animate-fadeIn">
        {/* 1. Phone Screen Q&A */}
        <button
          type="button"
          onClick={() => {
            setActiveViewFilter('specifications');
            setOpenSections((prev) => ({ ...prev, screeningKit: true }));
          }}
          className="p-3.5 rounded-2xl bg-gradient-to-br from-teal-50/90 to-white dark:from-teal-950/30 dark:to-surface-darkCard border border-teal-200/80 dark:border-teal-900/60 text-left hover-lift transition-all shadow-subtle group cursor-pointer"
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className="p-1.5 rounded-lg bg-teal-100 dark:bg-teal-900/50 text-teal-700 dark:text-teal-300">
              <HelpCircle className="w-4 h-4" />
            </span>
            <span className="text-[11px] font-bold text-teal-700 dark:text-teal-300 bg-teal-100/70 dark:bg-teal-900/40 px-2 py-0.5 rounded-full">
              5 Q&amp;A
            </span>
          </div>
          <h5 className="text-xs font-bold text-navy-950 dark:text-slate-100 group-hover:text-teal-700 dark:group-hover:text-teal-300 transition-colors">
            Phone Screen Kit
          </h5>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">
            Questions &amp; ideal answers
          </p>
        </button>

        {/* 2. Candidate Search String */}
        <button
          type="button"
          onClick={() => {
            setActiveViewFilter('sourcing');
            setOpenSections((prev) => ({ ...prev, boolean: true }));
            if (activeBooleanQuery) {
              handleCopyQuery();
            }
          }}
          className="p-3.5 rounded-2xl bg-gradient-to-br from-emerald-50/90 to-white dark:from-emerald-950/30 dark:to-surface-darkCard border border-emerald-200/80 dark:border-emerald-900/60 text-left hover-lift transition-all shadow-subtle group cursor-pointer"
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className="p-1.5 rounded-lg bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300">
              <Search className="w-4 h-4" />
            </span>
            <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-100/70 dark:bg-emerald-900/40 px-2 py-0.5 rounded-full flex items-center gap-1">
              <Copy className="w-3 h-3" />
              1-Click Copy
            </span>
          </div>
          <h5 className="text-xs font-bold text-navy-950 dark:text-slate-100 group-hover:text-emerald-700 dark:group-hover:text-emerald-300 transition-colors">
            Search Queries
          </h5>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">
            LinkedIn &amp; Naukri strings
          </p>
        </button>

        {/* 3. Target Companies */}
        <button
          type="button"
          onClick={() => {
            setActiveViewFilter('sourcing');
            setOpenSections((prev) => ({ ...prev, companies: true }));
          }}
          className="p-3.5 rounded-2xl bg-gradient-to-br from-indigo-50/90 to-white dark:from-indigo-950/30 dark:to-surface-darkCard border border-indigo-200/80 dark:border-indigo-900/60 text-left hover-lift transition-all shadow-subtle group cursor-pointer"
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className="p-1.5 rounded-lg bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300">
              <Building2 className="w-4 h-4" />
            </span>
            <span className="text-[11px] font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-100/70 dark:bg-indigo-900/40 px-2 py-0.5 rounded-full">
              {allCompanyObjects.length} Pools
            </span>
          </div>
          <h5 className="text-xs font-bold text-navy-950 dark:text-slate-100 group-hover:text-indigo-700 dark:group-hover:text-indigo-300 transition-colors">
            Target Companies
          </h5>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">
            Where to headhunt from
          </p>
        </button>

        {/* 4. Candidate Matches */}
        <button
          type="button"
          onClick={() => {
            setActiveViewFilter('candidates');
            setOpenSections((prev) => ({ ...prev, matches: true }));
          }}
          className="p-3.5 rounded-2xl bg-gradient-to-br from-blue-50/90 to-white dark:from-blue-950/30 dark:to-surface-darkCard border border-blue-200/80 dark:border-blue-900/60 text-left hover-lift transition-all shadow-subtle group cursor-pointer"
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className="p-1.5 rounded-lg bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300">
              <Users className="w-4 h-4" />
            </span>
            <span className="text-[11px] font-bold text-blue-700 dark:text-blue-300 bg-blue-100/70 dark:bg-blue-900/40 px-2 py-0.5 rounded-full">
              {matchingCandidates.length} Found
            </span>
          </div>
          <h5 className="text-xs font-bold text-navy-950 dark:text-slate-100 group-hover:text-blue-700 dark:group-hover:text-blue-300 transition-colors">
            Candidate Matches
          </h5>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">
            Top fit applicants ranked
          </p>
        </button>

        {/* 5. Job Advertisements */}
        <button
          type="button"
          onClick={() => {
            setActiveViewFilter('jobPosting');
          }}
          className="p-3.5 rounded-2xl bg-gradient-to-br from-amber-50/90 to-white dark:from-amber-950/30 dark:to-surface-darkCard border border-amber-200/80 dark:border-amber-900/60 text-left hover-lift transition-all shadow-subtle group col-span-2 sm:col-span-1 cursor-pointer"
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className="p-1.5 rounded-lg bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300">
              <Send className="w-4 h-4" />
            </span>
            <span className="text-[11px] font-bold text-amber-700 dark:text-amber-300 bg-amber-100/70 dark:bg-amber-900/40 px-2 py-0.5 rounded-full">
              5 Channels
            </span>
          </div>
          <h5 className="text-xs font-bold text-navy-950 dark:text-slate-100 group-hover:text-amber-700 dark:group-hover:text-amber-300 transition-colors">
            Job Ads &amp; Posts
          </h5>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">
            LinkedIn, Indeed, Naukri
          </p>
        </button>
      </div>

      {approvalSentMsg && (
        <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs text-emerald-700 dark:text-emerald-300">
          {approvalSentMsg}
        </div>
      )}

      {/* Executive View & Section Collapsible Controls Toolbar - Sticky within the detail pane */}
      <div className="sticky top-0 z-10 flex items-center justify-between flex-wrap gap-2.5 p-2 bg-white/95 dark:bg-surface-darkCard/95 backdrop-blur-md border border-slate-200/80 dark:border-surface-darkBorder rounded-xl shadow-xs">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mr-1 pl-1">
            Section:
          </span>
          {[
            { id: 'specifications', label: '1. Role Scope & Screening Q&A', badge: '5 Questions Ready' },
            { id: 'sourcing', label: '2. Search Strings & Companies', badge: 'LinkedIn & Naukri' },
            { id: 'candidates', label: '3. Candidate Matches', badge: `${matchingCandidates.length} Ranked` },
            { id: 'aiIntelligence', label: '4. Market & Supply Insights', badge: 'Hiring Difficulty' },
            { id: 'jobPosting', label: '5. Job Ads & Distribution', badge: 'Ready to Publish' },
          ].map((tab) => {
            const isActive = activeViewFilter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleSelectViewFilter(tab.id)}
                className={`px-3.5 py-2 text-sm font-semibold rounded-xl transition-all flex items-center gap-2.5 ${
                  isActive
                    ? 'bg-navy-900 dark:bg-brand-600 text-white shadow-subtle'
                    : 'text-slate-700 dark:text-slate-200 hover:bg-slate-200/70 dark:hover:bg-surface-darkCard'
                }`}
              >
                <span>{tab.label}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  isActive ? 'bg-white/20 text-white' : 'bg-slate-200/80 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                }`}>
                  {tab.badge}
                </span>
              </button>
            );
          })}
        </div>

        {/* Global Expand / Collapse All Toggle Button + Full Page View Toggle */}
        <div className="flex items-center gap-2">
          {onToggleFullPageView && (
            <button
              type="button"
              onClick={onToggleFullPageView}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs sm:text-sm font-semibold rounded-xl border transition-colors shadow-subtle ${
                isFullPageView
                  ? 'bg-brand-50 dark:bg-brand-950/60 border-brand-300 dark:border-brand-700 text-brand-700 dark:text-brand-300 hover:bg-brand-100 dark:hover:bg-brand-900/80'
                  : 'bg-white dark:bg-surface-darkCard border-slate-200 dark:border-surface-darkBorder text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
              title={isFullPageView ? "Exit Full Page View (restore split view)" : "Full Page View (expand across entire screen)"}
            >
              {isFullPageView ? (
                <>
                  <Minimize2 className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400" />
                  <span>Split View</span>
                </>
              ) : (
                <>
                  <Maximize2 className="w-3.5 h-3.5 text-slate-500" />
                  <span>Full Page View</span>
                </>
              )}
            </button>
          )}

          <button
            type="button"
            onClick={toggleAllSections}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs sm:text-sm font-semibold rounded-xl bg-white dark:bg-surface-darkCard border border-slate-200 dark:border-surface-darkBorder text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shadow-subtle"
          >
            {isAllExpanded ? (
              <>
                <ChevronUp className="w-3.5 h-3.5 text-slate-500" />
                <span>Collapse All</span>
              </>
            ) : (
              <>
                <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
                <span>Expand All</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* 1. Structured Job Description Overview */}
      {shouldShowSection('summary') && (
        <div className="rounded-2xl border border-slate-200/80 dark:border-surface-darkBorder bg-white dark:bg-surface-darkCard shadow-subtle overflow-hidden transition-all">
          <button
            type="button"
            onClick={() => toggleSection('summary')}
            className="w-full flex items-center justify-between p-4 hover:bg-slate-50/70 dark:hover:bg-slate-800/50 transition-colors text-left"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 flex-shrink-0">
                <FileText className="w-4 h-4" />
              </div>
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-bold uppercase tracking-wider text-navy-950 dark:text-slate-100">
                  Job Summary &amp; Role Scope
                </h4>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 hidden sm:inline max-w-[320px] truncate">
                {job.description ? `${job.description.slice(0, 55)}...` : 'Specification details'}
              </span>
              <ChevronDown
                className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${
                  openSections.summary ? 'rotate-180' : ''
                }`}
              />
            </div>
          </button>

          {openSections.summary && (
            <div className="p-5 pt-1 border-t border-slate-100 dark:border-surface-darkBorder animate-fadeIn space-y-4">
              {/* Recruiter Friendly Tip */}
              <div className="recruiter-tip">
                <FileText className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
                <span><strong>Role Overview:</strong> Core responsibilities, required experience level, and key qualifications extracted directly from the job description.</span>
              </div>

              {/* Detailed Role Specifications Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 rounded-xl bg-slate-50 dark:bg-surface-darkBg border border-slate-200/80 dark:border-surface-darkBorder">
                <div>
                  <span className="text-xs uppercase font-bold text-slate-500 dark:text-slate-400 block tracking-wider mb-1">Department</span>
                  <span className="text-sm font-semibold text-navy-950 dark:text-slate-100 block">{job.department || 'Engineering & Delivery'}</span>
                </div>
                <div>
                  <span className="text-xs uppercase font-bold text-slate-500 dark:text-slate-400 block tracking-wider mb-1">Experience Level</span>
                  <span className="text-sm font-semibold text-navy-950 dark:text-slate-100 block">{job.experienceRequired || '5 - 8 Years'}</span>
                </div>
                <div>
                  <span className="text-xs uppercase font-bold text-slate-500 dark:text-slate-400 block tracking-wider mb-1">Location / Work Mode</span>
                  <span className="text-sm font-semibold text-navy-950 dark:text-slate-100 block">{job.location || 'Hyderabad / Remote'}</span>
                </div>
                <div>
                  <span className="text-xs uppercase font-bold text-slate-500 dark:text-slate-400 block tracking-wider mb-1">Source Document</span>
                  <span className="text-xs sm:text-sm font-semibold text-navy-950 dark:text-slate-100 truncate block font-mono text-slate-700 dark:text-slate-300" title={job.sourceFilename || ''}>
                    {job.sourceFilename || `jd_${String(job.id || '001').padStart(3, '0')}.txt`}
                  </span>
                </div>
              </div>

              {/* Detailed Scope Container with AI Structured Tabs */}
              <div id="jd-detailed-scope-container" className="pt-1 space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2 pb-1 border-b border-slate-100 dark:border-surface-darkBorder">
                  <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-surface-darkBg rounded-xl border border-slate-200/70 dark:border-surface-darkBorder">
                    <button
                      type="button"
                      onClick={() => setScopeTab('structured')}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all inline-flex items-center gap-1.5 ${
                        scopeTab === 'structured'
                          ? 'bg-white dark:bg-surface-darkCard text-navy-900 dark:text-slate-100 shadow-sm'
                          : 'text-slate-600 dark:text-slate-400 hover:text-navy-900 dark:hover:text-slate-200'
                      }`}
                    >
                      <Sparkles className="w-3.5 h-3.5 text-brand-500" />
                      <span>AI Structured Scope</span>
                      {job.structuredScope && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-bold">
                          12 Dimensions
                        </span>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => setScopeTab('original')}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all inline-flex items-center gap-1.5 ${
                        scopeTab === 'original'
                          ? 'bg-white dark:bg-surface-darkCard text-navy-900 dark:text-slate-100 shadow-sm'
                          : 'text-slate-600 dark:text-slate-400 hover:text-navy-900 dark:hover:text-slate-200'
                      }`}
                    >
                      <FileText className="w-3.5 h-3.5 text-slate-500" />
                      <span>Original Source Document</span>
                    </button>
                  </div>
                  <div className="flex items-center gap-2.5">
                    {scopeTab === 'original' && (job.originalText || job.description) && (
                      <button
                        type="button"
                        onClick={handleCopyOriginalSource}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-white dark:bg-surface-darkCard border border-slate-200 dark:border-surface-darkBorder text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors shadow-xs"
                        title="Copy original source document"
                      >
                        {copiedOriginalSource ? (
                          <Check className="w-3.5 h-3.5 text-emerald-500" />
                        ) : (
                          <Copy className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                        )}
                        <span>{copiedOriginalSource ? 'Copied' : 'Copy'}</span>
                      </button>
                    )}
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      {scopeTab === 'structured' ? '✨ Deep semantic synthesis' : '📄 Verbatim source audit'}
                    </span>
                  </div>
                </div>

                {scopeTab === 'structured' ? (
                  job.structuredScope ? (
                    <div className="space-y-3 animate-fadeIn text-xs">
                      {/* 1. Inconsistencies Alert if detected */}
                      {job.structuredScope.jd_inconsistencies && job.structuredScope.jd_inconsistencies.length > 0 && (
                        <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700/60 space-y-1.5">
                          <div className="flex items-center gap-2 font-bold text-amber-900 dark:text-amber-200 text-xs">
                            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                            <span>JD Ambiguity & Inconsistency Analysis:</span>
                          </div>
                          <ul className="list-disc list-inside text-amber-800 dark:text-amber-300 space-y-1 pl-1">
                            {job.structuredScope.jd_inconsistencies.map((inc, i) => (
                              <li key={i}>
                                {typeof inc === 'string' ? inc : `${inc.category || 'Discrepancy'}: ${inc.description || inc.statement || JSON.stringify(inc)}`}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* 2. Role Overview & Business Context */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-surface-darkBg border border-slate-200 dark:border-surface-darkBorder space-y-1">
                          <span className="font-bold text-navy-950 dark:text-slate-100 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                            <Info className="w-3.5 h-3.5 text-brand-500" />
                            Role Overview
                          </span>
                          <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                            {job.structuredScope.role_overview || 'Comprehensive role owning technical delivery and architecture.'}
                          </p>
                        </div>
                        <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-surface-darkBg border border-slate-200 dark:border-surface-darkBorder space-y-1">
                          <span className="font-bold text-navy-950 dark:text-slate-100 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                            <Layers className="w-3.5 h-3.5 text-teal-500" />
                            Business Context
                          </span>
                          <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                            {job.structuredScope.business_context || 'Strategic business unit delivering enterprise software engineering solutions.'}
                          </p>
                        </div>
                      </div>

                      {/* 3. Technical Scope & Domain Expertise */}
                      <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-surface-darkBg border border-slate-200 dark:border-surface-darkBorder space-y-2">
                        <span className="font-bold text-navy-950 dark:text-slate-100 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                          <Zap className="w-3.5 h-3.5 text-amber-500" />
                          Technical Scope & Architecture
                        </span>
                        <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                          {job.structuredScope.technical_scope || 'End-to-end design, implementation, verification, and systems integration.'}
                        </p>
                        {job.structuredScope.domain_expertise && job.structuredScope.domain_expertise.length > 0 && (
                          <div className="pt-1 flex flex-wrap gap-1.5">
                            {job.structuredScope.domain_expertise.map((d, i) => (
                              <span key={i} className="px-2 py-0.5 rounded-md bg-teal-100/70 dark:bg-teal-950/60 text-teal-800 dark:text-teal-300 border border-teal-200 dark:border-teal-800 text-[11px] font-semibold">
                                {d}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* 4. Core & Functional Responsibilities */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-surface-darkBg border border-slate-200 dark:border-surface-darkBorder space-y-2">
                          <span className="font-bold text-navy-950 dark:text-slate-100 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                            <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                            Core Responsibilities
                          </span>
                          <ul className="space-y-1.5 text-slate-700 dark:text-slate-300">
                            {(job.structuredScope.core_responsibilities || []).map((r, i) => (
                              <li key={i} className="flex items-start gap-2">
                                <span className="text-emerald-500 mt-0.5">•</span>
                                <span>{r}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                        <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-surface-darkBg border border-slate-200 dark:border-surface-darkBorder space-y-2">
                          <span className="font-bold text-navy-950 dark:text-slate-100 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                            <CheckCircle className="w-3.5 h-3.5 text-sky-600" />
                            Functional & Lifecycle Deliverables
                          </span>
                          <ul className="space-y-1.5 text-slate-700 dark:text-slate-300">
                            {(job.structuredScope.functional_responsibilities || []).map((fr, i) => (
                              <li key={i} className="flex items-start gap-2">
                                <span className="text-sky-500 mt-0.5">•</span>
                                <span>{fr}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>

                      {/* 5. Missing Information Alert if any */}
                      {job.structuredScope.missing_information && job.structuredScope.missing_information.length > 0 && (
                        <div className="p-3 rounded-xl bg-slate-100 dark:bg-surface-darkBg border border-slate-200 dark:border-surface-darkBorder text-[11.5px] text-slate-600 dark:text-slate-400">
                          <span className="font-bold text-slate-700 dark:text-slate-300">Identified Gaps / Missing Requisition Details: </span>
                          {job.structuredScope.missing_information.join(' • ')}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-sm text-navy-900 dark:text-slate-200 leading-relaxed bg-slate-50/80 dark:bg-surface-darkBg p-4 border border-slate-200/90 dark:border-surface-darkBorder rounded-xl whitespace-pre-line font-normal shadow-xs">
                      {job.description || 'No description stored for this job.'}
                    </div>
                  )
                ) : (
                  <div className="text-xs text-navy-900 dark:text-slate-200 leading-relaxed bg-slate-50/90 dark:bg-surface-darkBg p-4 border border-slate-200 dark:border-surface-darkBorder rounded-xl font-mono whitespace-pre-line shadow-xs">
                    {job.originalText || job.description || 'No original source text recorded.'}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 2. Skills requirements breakdown distinguishing JD-derived vs Recruiter-added */}
      {shouldShowSection('competencies') && (
        <div className="rounded-2xl border border-slate-200/80 dark:border-surface-darkBorder bg-white dark:bg-surface-darkCard shadow-subtle overflow-hidden transition-all">
          <button
            type="button"
            onClick={() => toggleSection('competencies')}
            className="w-full flex items-center justify-between p-4 hover:bg-slate-50/70 dark:hover:bg-slate-800/50 transition-colors text-left"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-brand-50 dark:bg-brand-950/60 border border-brand-200/80 dark:border-brand-800 flex items-center justify-center text-brand-600 dark:text-brand-400 flex-shrink-0">
                <Tag className="w-4 h-4" />
              </div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h4 className="text-sm font-bold uppercase tracking-wider text-navy-950 dark:text-slate-100">
                  Must-Have &amp; Preferred Skills
                </h4>
                <span className="text-xs font-semibold text-brand-700 dark:text-brand-300 bg-brand-50 dark:bg-brand-950/60 px-2.5 py-0.5 rounded-full border border-brand-200/70 dark:border-brand-800">
                  {(job.requiredSkills || []).length} Mandatory
                  {job.preferredSkills?.length ? ` • ${job.preferredSkills.length} Preferred` : ''}
                </span>
              </div>
            </div>

            <ChevronDown
              className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${
                openSections.competencies ? 'rotate-180' : ''
              }`}
            />
          </button>

          {openSections.competencies && (
            <div className="p-5 pt-1 border-t border-slate-100 dark:border-surface-darkBorder space-y-4 animate-fadeIn">
              {/* Recruiter Friendly Tip */}
              <div className="recruiter-tip">
                <Tag className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
                <span><strong>Screening Tip:</strong> Mandatory skills represent non-negotiable requirements for screening. Preferred skills are bonus qualifications.</span>
              </div>

              <div className="space-y-3">
                <div>
                  <span className="text-xs font-bold text-slate-600 dark:text-slate-300 block mb-2 uppercase tracking-wider">Mandatory Skills:</span>
                  <div className="flex flex-wrap gap-2">
                    {(job.requiredSkills || []).map((sk, idx) => (
                      <span
                        key={idx}
                        className={`inline-flex items-center px-3 py-1.5 rounded-xl text-xs sm:text-sm font-semibold border ${
                          syncedMandatorySet.has(sk)
                            ? 'bg-teal-50 dark:bg-teal-950/50 text-teal-800 dark:text-teal-300 border-teal-300 dark:border-teal-700/60'
                            : 'bg-brand-50 dark:bg-brand-950/50 text-brand-800 dark:text-brand-300 border-brand-300 dark:border-brand-700/60'
                        }`}
                      >
                        {sk}
                        {syncedMandatorySet.size > 0 && (
                          <span className="ml-1.5 opacity-70 text-[10px] uppercase font-bold">
                            ({syncedMandatorySet.has(sk) ? 'JD' : 'Recruiter'})
                          </span>
                        )}
                      </span>
                    ))}
                  </div>
                </div>

                {job.preferredSkills && job.preferredSkills.length > 0 && (
                  <div className="pt-1">
                    <span className="text-xs font-bold text-slate-600 dark:text-slate-300 block mb-2 uppercase tracking-wider">Preferred Skills:</span>
                    <div className="flex flex-wrap gap-2">
                      {job.preferredSkills.map((sk, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center px-3 py-1.5 rounded-xl text-xs sm:text-sm font-medium bg-slate-100 dark:bg-surface-darkBg text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-surface-darkBorder"
                        >
                          {sk}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 3. AI Technical Screening & Recruiter Interview Kit */}
      {shouldShowSection('screeningKit') && (
        <div className="rounded-2xl border border-teal-200/90 dark:border-teal-900/60 bg-white dark:bg-surface-darkCard shadow-subtle overflow-hidden transition-all">
          <div className="w-full flex items-center justify-between p-4 hover:bg-teal-50/40 dark:hover:bg-teal-950/30 transition-colors flex-wrap gap-2">
            <button
              type="button"
              onClick={() => toggleSection('screeningKit')}
              className="flex-1 flex items-center gap-3 text-left min-w-[220px]"
            >
              <div className="w-8 h-8 rounded-xl bg-teal-50 dark:bg-teal-950/60 border border-teal-200/80 dark:border-teal-800 flex items-center justify-center text-teal-600 dark:text-teal-400 shadow-subtle flex-shrink-0">
                <HelpCircle className="w-4 h-4" />
              </div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h4 className="text-sm font-bold uppercase tracking-wider text-navy-950 dark:text-slate-100 flex items-center gap-1.5">
                  5-Question Phone Screening Cheatsheet
                </h4>
                <span className="text-xs font-semibold text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/60 px-2.5 py-0.5 rounded-full border border-teal-200/70 dark:border-teal-800">
                  5 Questions &amp; Ideal Answers Ready
                </span>
              </div>
            </button>

            {/* Quick Header Actions */}
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => toggleSection('screeningKit')}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                aria-label="Toggle screening kit section"
              >
                <ChevronDown
                  className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${
                    openSections.screeningKit ? 'rotate-180' : ''
                  }`}
                />
              </button>
            </div>
          </div>

          {openSections.screeningKit && (
            <div className="p-5 pt-1 border-t border-slate-100 dark:border-surface-darkBorder animate-fadeIn">
              {/* Recruiter Friendly Tip */}
              <div className="recruiter-tip mb-3">
                <HelpCircle className="w-4 h-4 text-teal-600 dark:text-teal-400 flex-shrink-0 mt-0.5" />
                <span><strong>Phone Screening Guide:</strong> Ask these 5 quick questions during your 15-minute introductory call to check candidate competency immediately without technical guesswork.</span>
              </div>

              <InterviewKitWorkspace
                job={job}
                candidates={filteredMatchingCandidates || matchingCandidates || []}
                onCandidateSelect={onSelectCandidate}
              />
            </div>
          )}
        </div>
      )}

      {/* 4. JD Related Companies & Target Sourcing Ecosystem */}
      {shouldShowSection('companies') && (
        <div className="rounded-2xl border border-slate-200/90 dark:border-surface-darkBorder bg-white dark:bg-surface-darkCard shadow-subtle overflow-hidden transition-all">
          {/* Header Bar */}
          <div className="w-full flex items-center justify-between p-4 hover:bg-slate-50/70 dark:hover:bg-slate-800/50 transition-colors flex-wrap gap-2">
            <button
              type="button"
              onClick={() => toggleSection('companies')}
              className="flex-1 flex items-center gap-3 text-left min-w-[240px]"
            >
              <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200/80 dark:border-indigo-800/80 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shadow-subtle flex-shrink-0">
                <Building2 className="w-4 h-4" />
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="text-sm font-bold uppercase tracking-wider text-navy-900 dark:text-slate-100">
                  Target Companies to Source Candidates From
                </h4>
                <span className="text-xs font-semibold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 px-2.5 py-0.5 rounded-full border border-indigo-200/70 dark:border-indigo-800">
                  {allCompanyObjects.length} suggested
                </span>
                {selectedCompanies.length > 0 && (
                  <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-0.5 rounded-full border border-emerald-200/70 dark:border-emerald-800">
                    {selectedCompanies.length} targeted
                  </span>
                )}
                {excludedCompanies.length > 0 && (
                  <span className="text-xs font-bold text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/60 px-2.5 py-0.5 rounded-full border border-rose-200/70 dark:border-rose-800">
                    {excludedCompanies.length} off-limits
                  </span>
                )}
              </div>
            </button>

            {/* Quick Header Actions */}
            <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
              {openSections.companies && (
                <>
                  {selectedCompanies.length > 0 && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleClearSelectedCompanies();
                      }}
                      className="text-xs text-slate-500 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400 font-semibold px-2.5 py-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                      title="Clear all target selections"
                    >
                      Clear Targets ({selectedCompanies.length})
                    </button>
                  )}
                  {excludedCompanies.length > 0 && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleClearExcludedCompanies();
                      }}
                      className="text-xs text-rose-600 dark:text-rose-400 hover:text-rose-700 font-semibold px-2.5 py-1 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                      title="Clear all off-limits exclusions"
                    >
                      Clear Off-Limits ({excludedCompanies.length})
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSelectAllCompanies();
                    }}
                    className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 font-semibold px-2.5 py-1 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-colors"
                  >
                    Target All ({allCompanies.length})
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleExportCompaniesExcel(false);
                    }}
                    className="inline-flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-300 hover:text-emerald-800 font-semibold px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 border border-emerald-200/80 dark:border-emerald-800/80 transition-colors"
                    title="Download beautified Excel spreadsheet with styled headings for recruiters"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download Excel</span>
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={() => toggleSection('companies')}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                aria-label="Toggle companies section"
              >
                <ChevronDown
                  className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${
                    openSections.companies ? 'rotate-180' : ''
                  }`}
                />
              </button>
            </div>
          </div>

          {openSections.companies && (
            <div className="p-5 pt-2 border-t border-slate-100 dark:border-surface-darkBorder animate-fadeIn space-y-4">
              {/* Recruiter Friendly Tip */}
              <div className="recruiter-tip">
                <Building2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400 flex-shrink-0 mt-0.5" />
                <span><strong>Headhunting Pools:</strong> Candidates currently working at these companies possess directly transferable tools and domain experience. Target them on LinkedIn or job boards.</span>
              </div>

              {/* Target Hiring Client Callout & Non-Poach Sourcing Advisory */}
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-surface-darkBg border border-slate-200/80 dark:border-surface-darkBorder space-y-2">
                <div className="flex items-center justify-between flex-wrap gap-2.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs sm:text-sm font-semibold text-slate-500 dark:text-slate-400">
                      Corporate Sourcing Ecosystem:
                    </span>
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs sm:text-sm font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                      <Building2 className="w-3.5 h-3.5" />
                      {targetCompaniesData?.ecosystem_name || 'Industry Corporate Sourcing Ecosystem'}
                    </span>
                    <span className="text-xs text-slate-400 dark:text-slate-500 hidden sm:inline">•</span>
                    <span className="text-xs sm:text-sm font-semibold text-slate-500 dark:text-slate-400">
                      Strategy:
                    </span>
                    <div className="inline-flex items-center gap-1.5">
                      <select
                        value={sourcingStrategy}
                        onChange={(e) => {
                          const stratId = e.target.value;
                          setSourcingStrategy(stratId);
                          const matched = SOURCING_STRATEGIES.find((s) => s.id === stratId);
                          if (matched && matched.catFilter) {
                            setCompanyCategoryFilter(matched.catFilter);
                          }
                        }}
                        className="text-xs sm:text-sm font-bold text-navy-950 dark:text-slate-100 bg-white dark:bg-surface-darkCard border border-slate-300 dark:border-surface-darkBorder rounded-xl px-2.5 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 cursor-pointer shadow-2xs"
                        aria-label="Talent Sourcing Strategy selector"
                      >
                        {SOURCING_STRATEGIES.map((strat) => (
                          <option key={strat.id} value={strat.id}>
                            {strat.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>
                      {targetCompaniesData?.intelligence_metadata?.workflow_engine === 'langgraph'
                        ? targetCompaniesData?.intelligence_metadata?.ollama_used
                          ? `LangGraph + Ollama (${Math.round((targetCompaniesData.intelligence_metadata.classification_confidence || 0) * 100)}% conf.)`
                          : 'LangGraph Deterministic Match'
                        : 'Ecosystem Matching: Deterministic Catalog Matching'}
                    </span>
                  </div>
                </div>
                {targetCompaniesError && (
                  <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300">
                    <span>{targetCompaniesError}</span>
                    <button
                      type="button"
                      onClick={() => {
                        setTargetCompaniesError('');
                        setTargetCompaniesLoading(true);
                        jobApi.getTargetCompanies(job.numeric_id || job.id)
                          .then((data) => setTargetCompaniesData(data))
                          .catch((err) => setTargetCompaniesError(err?.message || 'Failed to load target companies'))
                          .finally(() => setTargetCompaniesLoading(false));
                      }}
                      className="px-2 py-0.5 rounded bg-rose-100 dark:bg-rose-900/60 font-semibold hover:bg-rose-200"
                    >
                      Retry
                    </button>
                  </div>
                )}
                {targetCompaniesData?.strategy_rationale && (
                  <div className="text-xs text-slate-600 dark:text-slate-300 italic pt-1 border-t border-slate-200/60 dark:border-surface-darkBorder/60 space-y-1">
                    <div>
                      💡 <strong>Strategy Rationale:</strong> {targetCompaniesData.strategy_rationale}
                    </div>
                    {targetCompaniesData?.intelligence_metadata?.jd_skills_used?.length > 0 && (
                      <div className="not-italic text-[11px] text-slate-500 dark:text-slate-400">
                        <strong>JD Skills Matched:</strong>{' '}
                        {targetCompaniesData.intelligence_metadata.jd_skills_used.slice(0, 6).join(', ')}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Industry Ecosystem Category Filter & Toolbar Controls */}
              <div className="space-y-2.5 pt-1">
                {/* Main Control Bar with Dropdown Buttons */}
                <div className="flex items-center justify-between flex-wrap gap-2.5">
                  {/* Category Selector Dropdown Button */}
                  <div className="w-full sm:w-60 flex-shrink-0">
                    <CustomSelect
                      value={companyCategoryFilter}
                      onChange={setCompanyCategoryFilter}
                      options={COMPANY_CATEGORIES.map((cat) => {
                        const count =
                          cat.id === 'all'
                            ? allCompanyObjects.length
                            : allCompanyObjects.filter((co) => co.category === cat.id).length;
                        return {
                          value: cat.id,
                          label: cat.label,
                          badge: count,
                        };
                      })}
                      icon={Building2}
                      size="sm"
                      placeholder="Select Category..."
                      ariaLabel="Filter companies by ecosystem category"
                    />
                  </div>

                  {/* Sourcing Actions Dropdown Button */}
                  <div className="w-full sm:w-52 flex-shrink-0">
                    <CustomSelect
                      value=""
                      onChange={handleBulkActionSelect}
                      options={[
                        {
                          value: 'target_tab',
                          label: `Target All in View (${filteredCompanyObjects.length})`,
                        },
                        {
                          value: 'exclude_tab',
                          label: `Exclude All in View (${filteredCompanyObjects.length})`,
                        },
                        {
                          value: 'target_all',
                          label: `Target All Suggested (${allCompanies.length})`,
                        },
                        {
                          value: 'clear_targets',
                          label: `Clear Targets (${selectedCompanies.length})`,
                        },
                        {
                          value: 'clear_excluded',
                          label: `Clear Off-Limits (${excludedCompanies.length})`,
                        },
                        {
                          value: 'export_excel',
                          label: `Download Beautified Excel (Upto Tier 3: ${allCompanyObjects.length})`,
                        },
                        {
                          value: 'export_view_excel',
                          label: `Download Filtered Excel (${filteredCompanyObjects.length})`,
                        },
                        {
                          value: 'export_csv',
                          label: `Download Plain CSV (Upto Tier 3: ${allCompanyObjects.length})`,
                        },
                        {
                          value: 'export_view_csv',
                          label: `Download Filtered CSV (${filteredCompanyObjects.length})`,
                        },
                        {
                          value: 'export_pdf',
                          label: `Download PDF Report (.pdf)`,
                        },
                        {
                          value: 'export_word',
                          label: `Download Word Report (.docx)`,
                        },
                      ]}
                      icon={SlidersHorizontal}
                      size="sm"
                      placeholder="Sourcing Actions ▾"
                      ariaLabel="Sourcing bulk actions"
                    />
                  </div>

                  {/* Tier Filter Dropdown */}
                  <div className="min-w-[130px]">
                    <CustomSelect
                      value={companyTierFilter}
                      onChange={(val) => setCompanyTierFilter(val)}
                      options={[
                        { value: 'all', label: `All Tiers (Upto Tier 3: ${allCompanyObjects.length})` },
                        {
                          value: 'tier1',
                          label: `Tier 1: Core / OEMs / GCCs (${allCompanyObjects.filter((c) => (c.tier_level || c.tier || '').toLowerCase().includes('tier 1') || (c.tier_level || c.tier || '').toLowerCase().includes('tier-1') || c.category === 'oem' || c.category === 'gcc').length})`,
                        },
                        {
                          value: 'tier2',
                          label: `Tier 2: GSIs & Advisory (${allCompanyObjects.filter((c) => (c.tier_level || c.tier || '').toLowerCase().includes('tier 2') || (c.tier_level || c.tier || '').toLowerCase().includes('tier-2') || c.category === 'gsi' || c.category === 'big4').length})`,
                        },
                        {
                          value: 'tier3',
                          label: `Tier 3: Boutique & Regional (${allCompanyObjects.filter((c) => (c.tier_level || c.tier || '').toLowerCase().includes('tier 3') || (c.tier_level || c.tier || '').toLowerCase().includes('tier-3')).length})`,
                        },
                      ]}
                      icon={Layers}
                      size="sm"
                      placeholder="Filter Tier"
                      ariaLabel="Filter companies by sourcing tier"
                    />
                  </div>

                  {/* Search Filter Input */}
                  <div className="relative flex-1 min-w-[180px]">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={companySearchQuery}
                      onChange={(e) => setCompanySearchQuery(e.target.value)}
                      placeholder="Search company, location, tier..."
                      className="w-full pl-8 pr-7 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-surface-darkBorder bg-white dark:bg-surface-darkBg text-navy-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                    />
                    {companySearchQuery && (
                      <button
                        type="button"
                        onClick={() => setCompanySearchQuery('')}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5"
                        title="Clear search"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Add Custom Company Button */}
                  <button
                    type="button"
                    onClick={() => setShowAddCompanyInput((prev) => !prev)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                      showAddCompanyInput
                        ? 'bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 border-slate-300 dark:border-slate-600'
                        : 'border-dashed border-indigo-300 dark:border-indigo-700 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/30'
                    }`}
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{showAddCompanyInput ? 'Close Form' : 'Add Custom Company'}</span>
                  </button>

                  {/* Download Beautified Excel Button */}
                  <button
                    type="button"
                    onClick={() => handleExportCompaniesExcel(false)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white border border-emerald-600 hover:border-emerald-700 transition-all shadow-subtle cursor-pointer"
                    title="Download beautified Excel spreadsheet with styled headings, colors, and formatting"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download Excel</span>
                  </button>

                  {/* Download PDF Button */}
                  <button
                    type="button"
                    onClick={() => handleExportCompaniesDocument('pdf')}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white border border-rose-600 hover:border-rose-700 transition-all shadow-subtle cursor-pointer"
                    title="Download formatted PDF report of target companies"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>PDF</span>
                  </button>

                  {/* Download Word Button */}
                  <button
                    type="button"
                    onClick={() => handleExportCompaniesDocument('word')}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white border border-blue-600 hover:border-blue-700 transition-all shadow-subtle cursor-pointer"
                    title="Download formatted Word (.docx) report of target companies"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Word</span>
                  </button>

                  {/* Create Market Intelligence & Target Company Report Button */}
                  <button
                    type="button"
                    onClick={() => setShowMarketReportModal(true)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white border border-indigo-600 hover:border-indigo-700 transition-all shadow-subtle cursor-pointer"
                    title="Create detailed recruiter-friendly Market Intelligence & Target Company Report"
                  >
                    <FileBarChart2 className="w-3.5 h-3.5" />
                    <span>Create Report</span>
                  </button>

                  {/* View Mode Toggle: Cards vs Tags */}
                  <div className="inline-flex rounded-xl p-0.5 bg-slate-100 dark:bg-slate-800 border border-slate-200/80 dark:border-surface-darkBorder">
                    <button
                      type="button"
                      onClick={() => setCompanyViewMode('cards')}
                      className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all ${
                        companyViewMode === 'cards'
                          ? 'bg-white dark:bg-surface-darkCard text-navy-950 dark:text-slate-100 shadow-2xs font-bold'
                          : 'text-slate-500 hover:text-navy-900 dark:text-slate-400'
                      }`}
                      title="Rich cards view with company metadata and actions"
                    >
                      Cards View
                    </button>
                    <button
                      type="button"
                      onClick={() => setCompanyViewMode('tags')}
                      className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all ${
                        companyViewMode === 'tags'
                          ? 'bg-white dark:bg-surface-darkCard text-navy-950 dark:text-slate-100 shadow-2xs font-bold'
                          : 'text-slate-500 hover:text-navy-900 dark:text-slate-400'
                      }`}
                      title="Compact clickable tag pills view"
                    >
                      Tags View
                    </button>
                  </div>
                </div>

                {/* Responsive Non-Scrolling Category Quick Filter Chips */}
                <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                  {COMPANY_CATEGORIES.map((cat) => {
                    const Icon = cat.icon;
                    const isActive = companyCategoryFilter === cat.id;
                    const count =
                      cat.id === 'all'
                        ? allCompanyObjects.length
                        : allCompanyObjects.filter((c) => c.category === cat.id).length;

                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setCompanyCategoryFilter(cat.id)}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-semibold border transition-all duration-150 ${
                          isActive
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm ring-1 ring-indigo-500/30'
                            : 'bg-white dark:bg-surface-darkBg text-slate-700 dark:text-slate-200 border-slate-200/90 dark:border-surface-darkBorder hover:border-indigo-400 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                        }`}
                      >
                        <Icon className="w-3 h-3" />
                        <span>{cat.label}</span>
                        <span
                          className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                            isActive
                              ? 'bg-white/20 text-white'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                          }`}
                        >
                          {count}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Add Custom Company Drawer / Inline Form */}
              {showAddCompanyInput && (
                <form
                  onSubmit={handleAddCustomCompany}
                  className="p-4 rounded-xl bg-slate-50 dark:bg-surface-darkBg border border-indigo-200 dark:border-indigo-800 animate-fadeIn space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-navy-950 dark:text-slate-200 flex items-center gap-1.5">
                      <Plus className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                      Add Custom Target or Off-Limits Organization
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowAddCompanyInput(false)}
                      className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block mb-1">Company Name *</label>
                      <input
                        type="text"
                        value={customCompanyInput}
                        onChange={(e) => setCustomCompanyInput(e.target.value)}
                        placeholder="e.g. JPMorgan Chase, Synopsys"
                        autoFocus
                        required
                        className="w-full px-3 py-1.5 text-xs sm:text-sm rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-surface-darkCard text-navy-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block mb-1">Industry Category</label>
                      <select
                        value={customCompanyCategory}
                        onChange={(e) => setCustomCompanyCategory(e.target.value)}
                        className="w-full px-3 py-1.5 text-xs sm:text-sm rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-surface-darkCard text-navy-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                      >
                        <option value="oem">Product &amp; OEM</option>
                        <option value="big4">Big 4 &amp; Advisory</option>
                        <option value="gsi">Global System Integrator (GSI)</option>
                        <option value="gcc">Enterprise Captive / Tech Hub (GCC)</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block mb-1">Location / Practice Hub</label>
                      <input
                        type="text"
                        value={customCompanyLocation}
                        onChange={(e) => setCustomCompanyLocation(e.target.value)}
                        placeholder="e.g. Bangalore / Hyderabad"
                        className="w-full px-3 py-1.5 text-xs sm:text-sm rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-surface-darkCard text-navy-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setShowAddCompanyInput(false)}
                      className="px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-sm"
                    >
                      + Add &amp; Target Company
                    </button>
                  </div>
                </form>
              )}

              {/* Conditional View: Compact Tags View vs Rich Cards Grid */}
              {companyViewMode === 'tags' ? (
                /* Compact Interactive Tags View matching Screenshot 3 */
                <div className="p-4 rounded-2xl bg-white dark:bg-surface-darkCard border border-slate-200/80 dark:border-surface-darkBorder space-y-3 shadow-subtle animate-fadeIn">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                      <span className="text-xs font-bold text-navy-950 dark:text-slate-100">
                        Suggested Target Sourcing Companies ({filteredCompanyObjects.length}):
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-400 dark:text-slate-500">
                      Click to include in Boolean query
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    {filteredCompanyObjects.map((company) => {
                      const isTargeted = selectedCompanies.includes(company.name);
                      const isExcluded = excludedCompanies.includes(company.name);

                      return (
                        <button
                          key={company.name}
                          type="button"
                          onClick={() => handleToggleCompany(company.name)}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                            isTargeted
                              ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs font-bold'
                              : isExcluded
                              ? 'bg-rose-100 text-rose-700 border-rose-300 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800'
                              : 'bg-slate-50 dark:bg-surface-darkBg text-slate-700 dark:text-slate-200 border-slate-200/90 dark:border-surface-darkBorder hover:border-indigo-400 hover:bg-indigo-50/40 dark:hover:bg-slate-800'
                          }`}
                          title={isTargeted ? 'Targeted (click to remove)' : 'Click to target company in Boolean query'}
                        >
                          <span className="text-[11px] font-bold">{isTargeted ? '✓' : isExcluded ? '⊘' : '+'}</span>
                          <span>{company.name}</span>
                        </button>
                      );
                    })}
                    <button
                      type="button"
                      onClick={() => setShowAddCompanyInput(true)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border border-dashed border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:border-indigo-400 hover:text-indigo-600 transition-all"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Company</span>
                    </button>
                  </div>
                </div>
              ) : (
                /* Rich Company Cards Grid with Properly Fitted Target & Exclude Controls */
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-3.5 pt-1 animate-fadeIn">
                  {filteredCompanyObjects.map((company) => {
                    const isTargeted = selectedCompanies.includes(company.name);
                    const isExcluded = excludedCompanies.includes(company.name);
                    const isCustom = customCompanies.some(
                      (c) => c.name.toLowerCase() === company.name.toLowerCase()
                    );

                    const catMeta =
                      COMPANY_CATEGORIES.find((c) => c.id === company.category) ||
                      COMPANY_CATEGORIES[3];
                    const CatIcon = catMeta.icon;

                    const searchUrl = `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(
                      `"${job.title || 'Engineer'}" "${company.name}"`
                    )}`;

                    return (
                      <div
                        key={company.name}
                        className={`relative flex flex-col justify-between p-3.5 rounded-2xl border min-w-0 transition-all duration-150 ${
                          isTargeted
                            ? 'border-indigo-500 dark:border-indigo-400 bg-indigo-50/30 dark:bg-indigo-950/20 shadow-sm ring-1 ring-indigo-500/20'
                            : isExcluded
                            ? 'border-rose-400 dark:border-rose-600 bg-rose-50/30 dark:bg-rose-950/20 shadow-sm ring-1 ring-rose-500/20'
                            : 'border-slate-200/90 dark:border-surface-darkBorder bg-white dark:bg-surface-darkBg hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-subtle'
                        }`}
                      >
                        {/* Card Top: Category Badge, Tier Badge & External LinkedIn Search */}
                        <div>
                          <div className="flex items-center justify-between gap-1 mb-2">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold border uppercase tracking-wider ${
                                  catMeta.color ||
                                  'text-slate-600 bg-slate-50 border-slate-200'
                                }`}
                              >
                                <CatIcon className="w-3 h-3" />
                                <span>{catMeta.label.split(' ')[0]}</span>
                              </span>

                              <span
                                className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border ${
                                  (company.tier_level || '').includes('1') || (company.tier || '').toLowerCase().includes('tier-1') || (company.tier || '').toLowerCase().includes('tier 1')
                                    ? 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800'
                                    : (company.tier_level || '').includes('2') || (company.tier || '').toLowerCase().includes('tier-2') || (company.tier || '').toLowerCase().includes('tier 2')
                                    ? 'bg-sky-50 dark:bg-sky-950/50 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-800'
                                    : 'bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800'
                                }`}
                              >
                                {company.tier_level || (company.tier?.toLowerCase().includes('tier') ? company.tier.split(' ')[0] : 'Tier 1')}
                              </span>
                            </div>

                            <div className="flex items-center gap-1">
                              {/* LinkedIn Candidate Search Shortcut */}
                              <a
                                href={searchUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-1 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                title={`Search ${job.title} candidates at ${company.name} on LinkedIn`}
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </a>

                              {/* Remove Custom Company */}
                              {isCustom && (
                                <button
                                  type="button"
                                  onClick={(e) => handleRemoveCustomCompany(company.name, e)}
                                  className="p-1 text-slate-400 hover:text-rose-500 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                  title="Remove custom company"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Company Name & Tier */}
                          <div className="mb-1">
                            <h5 className="text-sm font-bold text-navy-950 dark:text-slate-100 leading-snug truncate">
                              {company.name}
                            </h5>
                            {company.tier && (
                              <span className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 truncate block">
                                {company.tier}
                              </span>
                            )}
                          </div>

                          {/* Location */}
                          {company.location && (
                            <div className="flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400 mb-1.5">
                              <MapPin className="w-3 h-3 flex-shrink-0 text-slate-400" />
                              <span className="truncate">{company.location}</span>
                            </div>
                          )}

                          {/* Description / Practice Notes */}
                          {company.description && (
                            <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed line-clamp-2 mb-2">
                              {company.description}
                            </p>
                          )}

                          {/* Grounded Recommendation Reason & Overlap Skills */}
                          {company.recommendation_reason && (
                            <div className="mt-2 p-2 rounded-xl bg-slate-50 dark:bg-surface-darkCard/60 border border-slate-200/70 dark:border-surface-darkBorder/60 text-[10.5px] text-slate-600 dark:text-slate-300 space-y-1">
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-navy-900 dark:text-slate-200 flex items-center gap-1">
                                  <Sparkles className="w-3 h-3 text-brand-500" />
                                  Why Recommended:
                                </span>
                                {company.confidence && (
                                  <span className={`px-1.5 py-0.2 rounded font-bold uppercase text-[9px] ${
                                    company.confidence === 'High'
                                      ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300'
                                      : 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300'
                                  }`}>
                                    {company.confidence} Fit
                                  </span>
                                )}
                              </div>
                              <p className="leading-relaxed">{company.recommendation_reason}</p>
                              {company.overlap_skills && company.overlap_skills.length > 0 && (
                                <div className="flex flex-wrap gap-1 pt-0.5">
                                  <span className="font-semibold text-slate-400">Skill overlap:</span>
                                  {company.overlap_skills.map((s, idx) => (
                                    <span key={idx} className="px-1.5 py-0.2 rounded bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 font-medium">
                                      {s}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Card Bottom: Segmented Target vs Exclude Control with Spacious Fit */}
                        <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-surface-darkBorder/60">
                          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-100/90 dark:bg-slate-800/80 border border-slate-200/60 dark:border-surface-darkBorder/40">
                            {/* Target Button */}
                            <button
                              type="button"
                              onClick={() => handleToggleCompany(company.name)}
                              className={`flex-1 h-7.5 px-2 rounded-lg text-[11px] font-bold transition-all duration-150 inline-flex items-center justify-center gap-1 min-w-0 ${
                                isTargeted
                                  ? 'bg-indigo-600 text-white shadow-xs'
                                  : 'text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-white dark:hover:bg-slate-700/60'
                              }`}
                              title={isTargeted ? 'Targeted in Boolean pool (click to untarget)' : 'Click to add to target sourcing pool'}
                            >
                              {isTargeted ? (
                                <>
                                  <Check className="w-3.5 h-3.5 flex-shrink-0 text-white" />
                                  <span className="truncate">Targeted</span>
                                </>
                              ) : (
                                <>
                                  <Target className="w-3.5 h-3.5 flex-shrink-0 text-slate-400" />
                                  <span className="truncate">Target</span>
                                </>
                              )}
                            </button>

                            {/* Off-Limits Exclude Button */}
                            <button
                              type="button"
                              onClick={() => handleToggleExcludeCompany(company.name)}
                              className={`flex-1 h-7.5 px-2 rounded-lg text-[11px] font-bold transition-all duration-150 inline-flex items-center justify-center gap-1 min-w-0 ${
                                isExcluded
                                  ? 'bg-rose-600 text-white shadow-xs'
                                  : 'text-slate-600 dark:text-slate-300 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-white dark:hover:bg-slate-700/60'
                              }`}
                              title={isExcluded ? 'Marked as off-limits (click to unmark)' : 'Click to mark as off-limits (NOT clause)'}
                            >
                              <Ban className={`w-3.5 h-3.5 flex-shrink-0 ${isExcluded ? 'text-white' : 'text-rose-500'}`} />
                              <span className="truncate">{isExcluded ? 'Excluded' : 'Exclude'}</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {filteredCompanyObjects.length === 0 && (
                <div className="text-center py-8 text-slate-400 dark:text-slate-500 text-xs sm:text-sm">
                  No companies found matching &ldquo;{companySearchQuery}&rdquo; in this category.
                  <button
                    type="button"
                    onClick={() => {
                      setCompanySearchQuery('');
                      setCompanyCategoryFilter('all');
                    }}
                    className="block mx-auto mt-2 text-indigo-600 dark:text-indigo-400 font-semibold hover:underline"
                  >
                    Reset filters
                  </button>
                </div>
              )}

              {/* Live Sourcing Boolean Clause Preview Drawer */}
              {(selectedCompanies.length > 0 || excludedCompanies.length > 0) && (
                <div className="mt-4 p-4 rounded-xl bg-slate-50 dark:bg-surface-darkBg border border-slate-200 dark:border-surface-darkBorder space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-navy-950 dark:text-slate-200 flex items-center gap-1.5">
                      <Zap className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400" />
                      Live Boolean Sourcing Clauses Preview
                    </span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      Auto-synced with Boolean Query Generator below
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {/* Target Pool Clause */}
                    <div className="p-3 rounded-lg bg-white dark:bg-surface-darkCard border border-slate-200 dark:border-surface-darkBorder">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-bold text-indigo-700 dark:text-indigo-300 flex items-center gap-1">
                          <Target className="w-3 h-3" />
                          Target Pool ({selectedCompanies.length || 'Top 4'}):
                        </span>
                        <button
                          type="button"
                          onClick={handleCopyTargetClause}
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
                        >
                          {copiedTargetClause ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                          <span>{copiedTargetClause ? 'Copied' : 'Copy Clause'}</span>
                        </button>
                      </div>
                      <code className="text-xs font-mono text-slate-800 dark:text-slate-200 break-words line-clamp-3 block bg-slate-50 dark:bg-slate-900 p-2 rounded">
                        {`(${ (selectedCompanies.length > 0 ? selectedCompanies : allCompanies.slice(0, 4)).map((c) => `"${c}"`).join(' OR ') })`}
                      </code>
                    </div>

                    {/* Non-Poach Off-Limits Clause */}
                    <div className="p-3 rounded-lg bg-white dark:bg-surface-darkCard border border-slate-200 dark:border-surface-darkBorder">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-bold text-rose-700 dark:text-rose-300 flex items-center gap-1">
                          <Ban className="w-3 h-3" />
                          Non-Poach Exclusions ({excludedCompanies.length}):
                        </span>
                        {excludedCompanies.length > 0 && (
                          <button
                            type="button"
                            onClick={handleCopyExcludedClause}
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-600 dark:text-rose-400 hover:underline"
                          >
                            {copiedExcludedClause ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                            <span>{copiedExcludedClause ? 'Copied' : 'Copy Clause'}</span>
                          </button>
                        )}
                      </div>
                      <code className="text-xs font-mono text-slate-800 dark:text-slate-200 break-words line-clamp-3 block bg-slate-50 dark:bg-slate-900 p-2 rounded">
                        {excludedCompanies.length > 0
                          ? `NOT (${excludedCompanies.map((c) => `"${c}"`).join(' OR ')})`
                          : 'No off-limits companies designated (safe to source from all)'}
                      </code>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 5. Naukri & Sourcing Boolean Search Generator */}
      {shouldShowSection('boolean') && (
        <div className="rounded-2xl border border-slate-200/90 dark:border-surface-darkBorder bg-white dark:bg-surface-darkCard shadow-subtle overflow-hidden transition-all">
          <div className="w-full flex items-center justify-between p-4 hover:bg-slate-50/70 dark:hover:bg-slate-800/50 transition-colors flex-wrap gap-2">
            <button
              type="button"
              onClick={() => toggleSection('boolean')}
              className="flex-1 flex items-center gap-3 text-left min-w-[200px]"
            >
              <div className="w-8 h-8 rounded-xl bg-brand-50 dark:bg-brand-950/60 border border-brand-200/80 dark:border-brand-800/80 flex items-center justify-center text-brand-600 dark:text-brand-400 shadow-subtle flex-shrink-0">
                <Search className="w-4 h-4" />
              </div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h4 className="text-sm font-bold uppercase tracking-wider text-navy-900 dark:text-slate-100">
                  Candidate Search Strings (LinkedIn, Naukri, Indeed)
                </h4>
                <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-0.5 rounded-full border border-emerald-200/70 dark:border-emerald-800">
                  {sourcingPlatform === 'keywords' ? 'Plain Keywords' : sourcingPlatform === 'naukri' ? 'Naukri Resdex' : sourcingPlatform === 'linkedin' ? 'LinkedIn Recruiter' : 'Google X-Ray'} • {(activeBooleanQuery || '').length} chars
                </span>
              </div>
            </button>

            {/* Quick External Launch, Customize & Copy Triggers */}
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={handleToggleCustomMode}
                className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border text-xs sm:text-sm font-semibold shadow-subtle transition-all ${
                  isCustomMode
                    ? 'bg-brand-50 dark:bg-brand-950/60 border-brand-400 dark:border-brand-700 text-brand-700 dark:text-brand-300 ring-2 ring-brand-500/20'
                    : 'bg-white dark:bg-surface-darkCard border-slate-200 dark:border-surface-darkBorder text-slate-700 dark:text-slate-200 hover:border-brand-400 dark:hover:border-brand-500 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                <Edit3 className={`w-4 h-4 ${isCustomMode ? 'text-brand-600 dark:text-brand-400' : 'text-slate-400'}`} />
                <span>{isCustomMode ? 'Editing Query' : 'Customize Query'}</span>
              </button>

              <button
                type="button"
                onClick={handleLaunchSearch}
                title={`Launch query in ${sourcingPlatform === 'xray' ? 'Google X-Ray' : sourcingPlatform === 'linkedin' ? 'LinkedIn' : 'Web Search'}`}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border border-slate-200 dark:border-surface-darkBorder hover:border-brand-400 dark:hover:border-brand-500 text-slate-700 dark:text-slate-200 bg-white dark:bg-surface-darkCard text-xs sm:text-sm font-semibold shadow-subtle hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              >
                <Globe className="w-4 h-4 text-brand-600 dark:text-brand-400" />
                <span>Launch Search</span>
                <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
              </button>

              <button
                type="button"
                onClick={() => handleCopyBoolean()}
                className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs sm:text-sm font-semibold shadow-subtle transition-all duration-150 ${
                  copiedBoolean
                    ? 'bg-emerald-600 text-white'
                    : 'bg-navy-900 dark:bg-brand-600 hover:bg-navy-950 dark:hover:bg-brand-700 text-white'
                }`}
              >
                {copiedBoolean ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                <span>{copiedBoolean ? 'Copied to Clipboard!' : sourcingPlatform === 'keywords' ? 'Copy Keywords' : 'Copy Boolean'}</span>
              </button>

              <button
                type="button"
                onClick={handleSaveBooleanSearch}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border border-slate-200 dark:border-surface-darkBorder text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-surface-darkCard hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                <Save className="w-4 h-4 text-brand-600 dark:text-brand-400" />
                <span>Save Search</span>
              </button>

              <button
                type="button"
                onClick={() => toggleSection('boolean')}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                aria-label="Toggle boolean search section"
              >
                <ChevronDown
                  className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${
                    openSections.boolean ? 'rotate-180' : ''
                  }`}
                />
              </button>
            </div>
          </div>

          {openSections.boolean && (
            <div className="p-4 pt-1 border-t border-slate-100 dark:border-surface-darkBorder animate-fadeIn space-y-4">
              {/* Recruiter Friendly Tip */}
              <div className="recruiter-tip">
                <Search className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
                <span><strong>One-Click Search:</strong> Copy these search strings directly into LinkedIn Recruiter, Naukri Resdex, or Google to find qualified candidates immediately.</span>
              </div>

              {/* Sourcing Platform Selector Tabs & Mode Status */}
          <div className="flex items-center justify-between flex-wrap gap-2 pb-3 border-b border-slate-100 dark:border-surface-darkBorder">
            <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-surface-darkBg rounded-xl border border-slate-200/70 dark:border-surface-darkBorder flex-wrap">
              <button
                type="button"
                onClick={() => {
                  setSourcingPlatform('naukri');
                  if (isCustomMode) setIsCustomMode(false);
                }}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                  sourcingPlatform === 'naukri'
                    ? 'bg-white dark:bg-surface-darkCard text-navy-900 dark:text-slate-100 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-navy-900 dark:hover:text-slate-200'
                }`}
              >
                Naukri Resdex
              </button>
              <button
                type="button"
                onClick={() => {
                  setSourcingPlatform('linkedin');
                  if (isCustomMode) setIsCustomMode(false);
                }}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                  sourcingPlatform === 'linkedin'
                    ? 'bg-white dark:bg-surface-darkCard text-navy-900 dark:text-slate-100 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-navy-900 dark:hover:text-slate-200'
                }`}
              >
                LinkedIn Recruiter
              </button>
              <button
                type="button"
                onClick={() => {
                  setSourcingPlatform('xray');
                  if (isCustomMode) setIsCustomMode(false);
                }}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                  sourcingPlatform === 'xray'
                    ? 'bg-white dark:bg-surface-darkCard text-navy-900 dark:text-slate-100 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-navy-900 dark:hover:text-slate-200'
                }`}
              >
                Google X-Ray
              </button>
              <button
                type="button"
                onClick={() => {
                  setSourcingPlatform('keywords');
                  if (isCustomMode) setIsCustomMode(false);
                }}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all inline-flex items-center gap-1.5 ${
                  sourcingPlatform === 'keywords'
                    ? 'bg-teal-700 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-navy-900 dark:hover:text-slate-200'
                }`}
              >
                <Tag className="w-3.5 h-3.5 text-teal-400" />
                <span>Just Keywords (Simple)</span>
              </button>
            </div>

            <div className="flex items-center gap-1 p-1 bg-slate-50 dark:bg-surface-darkBg rounded-xl border border-slate-200/70 dark:border-surface-darkBorder">
              {['broad', 'balanced', 'strict'].map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => {
                    setSearchDepth(mode);
                    setNaukriStrictAnd(mode !== 'broad');
                    if (isCustomMode) setIsCustomMode(false);
                  }}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold capitalize ${
                    searchDepth === mode
                      ? 'bg-navy-900 text-white dark:bg-brand-600'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>

            {/* Mode & Character Length & Syntax Validity badge */}
            <div className="flex items-center gap-2 text-xs flex-wrap">
              {isCustomMode ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand-700 dark:text-brand-300 bg-brand-50 dark:bg-brand-950/60 px-2.5 py-0.5 rounded-full border border-brand-200 dark:border-brand-800">
                  <Edit3 className="w-3 h-3" />
                  Customized Mode
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-surface-darkBg px-2.5 py-0.5 rounded-full border border-slate-200 dark:border-surface-darkBorder">
                  <Sparkles className="w-3 h-3 text-brand-500" />
                  {booleanLoading ? 'Generating...' : generatedQueries ? 'Generation Result' : 'Deterministic Fallback'}
                </span>
              )}

              <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                {activeBooleanQuery.length} chars (Limit: 1000)
              </span>

              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                <Zap className="w-3 h-3" />
                Valid
              </span>
            </div>
          </div>

          {booleanError && (
            <div role="alert" className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/40 px-3 py-2 text-xs text-red-700 dark:text-red-300">
              Boolean generation failed: {booleanError}. No AI-generated result is being shown.
            </div>
          )}

          {/* Format Options Toolbar when in Just Keywords mode */}
          {sourcingPlatform === 'keywords' && (
            <div className="flex items-center justify-between flex-wrap gap-2.5 p-2.5 bg-teal-50/60 dark:bg-teal-950/30 border border-teal-200/80 dark:border-teal-900/60 rounded-xl text-xs animate-fadeIn">
              <div className="flex items-center gap-2">
                <Tag className="w-4 h-4 text-teal-600 dark:text-teal-400 flex-shrink-0" />
                <span className="font-bold text-navy-950 dark:text-slate-100 text-[11px] uppercase tracking-wider">
                  Keywords Format:
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 hidden sm:inline">
                  (Comma-separated is recommended for portal keyword tags)
                </span>
              </div>

              <div className="flex items-center gap-1.5 flex-wrap">
                {[
                  { id: 'comma', label: 'Comma (, )' },
                  { id: 'space', label: 'Quoted Space (" ")' },
                  { id: 'pipe', label: 'Pipe ( | )' },
                ].map((delim) => (
                  <button
                    key={delim.id}
                    type="button"
                    onClick={() => {
                      setKeywordDelimiter(delim.id);
                      if (isCustomMode) setIsCustomMode(false);
                    }}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all ${
                      keywordDelimiter === delim.id
                        ? 'bg-teal-700 text-white shadow-sm'
                        : 'bg-white dark:bg-surface-darkCard text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-surface-darkBorder hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    {delim.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Interactive Boolean Filter Chips */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setNaukriStrictAnd((v) => !v);
                if (isCustomMode) setIsCustomMode(false);
              }}
              className={`px-3 py-1 rounded-xl text-xs font-semibold border transition-all ${
                naukriStrictAnd
                  ? 'bg-brand-50 dark:bg-brand-950/40 text-brand-700 dark:text-brand-300 border-brand-300 dark:border-brand-800 shadow-xs'
                  : 'bg-slate-50 dark:bg-surface-darkBg text-slate-600 dark:text-slate-300 border-slate-200 dark:border-surface-darkBorder'
              }`}
            >
              Mandatory Skills: {naukriStrictAnd ? 'Strict (AND)' : 'Broad (OR)'}
            </button>

            {job.preferredSkills && job.preferredSkills.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setIncludePreferredInBoolean((v) => !v);
                  if (isCustomMode) setIsCustomMode(false);
                }}
                className={`px-3 py-1 rounded-xl text-xs font-semibold border transition-all ${
                  includePreferredInBoolean
                    ? 'bg-brand-50 dark:bg-brand-950/40 text-brand-700 dark:text-brand-300 border-brand-300 dark:border-brand-800 shadow-xs'
                    : 'bg-slate-50 dark:bg-surface-darkBg text-slate-600 dark:text-slate-300 border-slate-200 dark:border-surface-darkBorder'
                }`}
              >
                {includePreferredInBoolean ? '✓ ' : '+ '}Preferred Skills ({job.preferredSkills.length})
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                setIncludeCompaniesInBoolean((v) => !v);
                if (isCustomMode) setIsCustomMode(false);
              }}
              className={`px-3 py-1 rounded-xl text-xs font-semibold border transition-all ${
                includeCompaniesInBoolean
                  ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border-indigo-300 dark:border-indigo-800 shadow-xs'
                  : 'bg-slate-50 dark:bg-surface-darkBg text-slate-600 dark:text-slate-300 border-slate-200 dark:border-surface-darkBorder'
              }`}
            >
              {includeCompaniesInBoolean ? '✓ ' : '+ '}Target Companies (
              {selectedCompanies.length > 0 ? selectedCompanies.length : 'All Suggested'})
            </button>

            {job.location && (
              <button
                type="button"
                onClick={() => {
                  setIncludeLocationInBoolean((v) => !v);
                  if (isCustomMode) setIsCustomMode(false);
                }}
                className={`px-3 py-1 rounded-xl text-xs font-semibold border transition-all ${
                  includeLocationInBoolean
                    ? 'bg-cyan-50 dark:bg-cyan-950/40 text-cyan-700 dark:text-cyan-300 border-cyan-300 dark:border-cyan-800 shadow-xs'
                    : 'bg-slate-50 dark:bg-surface-darkBg text-slate-600 dark:text-slate-300 border-slate-200 dark:border-surface-darkBorder'
                }`}
              >
                {includeLocationInBoolean ? '✓ ' : '+ '}Include Location
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                setIncludeNoticeInBoolean((v) => !v);
                if (isCustomMode) setIsCustomMode(false);
              }}
              className={`px-3 py-1 rounded-xl text-xs font-semibold border transition-all ${
                includeNoticeInBoolean
                  ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-800 shadow-xs'
                  : 'bg-slate-50 dark:bg-surface-darkBg text-slate-600 dark:text-slate-300 border-slate-200 dark:border-surface-darkBorder'
              }`}
            >
              {includeNoticeInBoolean ? '✓ ' : '+ '}Immediate Joiners (≤30 Days)
            </button>

            {/* Sourcing Exclusions (Negative Sourcing NOT) */}
            <button
              type="button"
              onClick={() => {
                setIncludeExclusionsInBoolean((v) => !v);
                if (isCustomMode) setIsCustomMode(false);
              }}
              className={`px-3 py-1 rounded-xl text-xs font-semibold border transition-all ${
                includeExclusionsInBoolean
                  ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-800 shadow-xs'
                  : 'bg-slate-50 dark:bg-surface-darkBg text-slate-600 dark:text-slate-300 border-slate-200 dark:border-surface-darkBorder'
              }`}
            >
              {includeExclusionsInBoolean ? '✓ ' : '+ '}Exclude Interns / Trainees (NOT)
            </button>

            {/* Seniority / Lead Booster */}
            <button
              type="button"
              onClick={() => {
                setIncludeSeniorityInBoolean((v) => !v);
                if (isCustomMode) setIsCustomMode(false);
              }}
              className={`px-3 py-1 rounded-xl text-xs font-semibold border transition-all ${
                includeSeniorityInBoolean
                  ? 'bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border-purple-300 dark:border-purple-800 shadow-xs'
                  : 'bg-slate-50 dark:bg-surface-darkBg text-slate-600 dark:text-slate-300 border-slate-200 dark:border-surface-darkBorder'
              }`}
            >
              {includeSeniorityInBoolean ? '✓ ' : '+ '}Senior / Lead Focus
            </button>
          </div>

          {searchHistory.length > 0 && (
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 whitespace-nowrap">Saved searches</span>
              {searchHistory.slice(0, 6).map((row) => (
                <button
                  key={row.id}
                  type="button"
                  onClick={() => {
                    setIsCustomMode(true);
                    setCustomQueryText(row.query_text);
                  }}
                  className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-surface-darkBorder text-[11px] text-slate-700 dark:text-slate-300 whitespace-nowrap"
                >
                  {row.platform} · {row.search_mode}
                </button>
              ))}
            </div>
          )}

          {/* Quick Syntax Insertion Toolbar when in Custom Mode */}
          {isCustomMode && (
            <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 bg-slate-100 dark:bg-surface-darkBg rounded-xl border border-slate-200/80 dark:border-surface-darkBorder animate-fadeIn">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mr-1">Insert Operator:</span>
                <button
                  type="button"
                  onClick={() => handleInsertOperator(' AND ')}
                  className="px-2 py-0.5 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 text-[11px] font-bold hover:bg-emerald-200 transition-colors"
                >
                  + AND
                </button>
                <button
                  type="button"
                  onClick={() => handleInsertOperator(' OR ')}
                  className="px-2 py-0.5 rounded-lg bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800 text-[11px] font-bold hover:bg-amber-200 transition-colors"
                >
                  + OR
                </button>
                <button
                  type="button"
                  onClick={() => handleInsertOperator(' NOT ')}
                  className="px-2 py-0.5 rounded-lg bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-800 text-[11px] font-bold hover:bg-rose-200 transition-colors"
                >
                  + NOT
                </button>
                <button
                  type="button"
                  onClick={() => handleInsertOperator('""')}
                  className="px-2 py-0.5 rounded-lg bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[11px] font-mono font-bold hover:bg-slate-300 transition-colors"
                >
                  + "Quotes"
                </button>
                <button
                  type="button"
                  onClick={() => handleInsertOperator('()')}
                  className="px-2 py-0.5 rounded-lg bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[11px] font-mono font-bold hover:bg-slate-300 transition-colors"
                >
                  + (Parens)
                </button>
              </div>

              <button
                type="button"
                onClick={handleResetToAutoQuery}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 hover:text-navy-900 dark:text-slate-400 dark:hover:text-slate-100 px-2 py-0.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset to AI Auto</span>
              </button>
            </div>
          )}

          {/* Conversational Boolean Customizer with local Ollama */}
          <div className="p-3.5 rounded-xl bg-gradient-to-r from-brand-50/60 via-slate-50 to-teal-50/60 dark:from-surface-darkBg dark:via-surface-darkCard dark:to-surface-darkBg border border-brand-200/80 dark:border-surface-darkBorder space-y-2">
            <div className="flex items-center justify-between flex-wrap gap-1">
              <span className="text-xs font-bold text-navy-900 dark:text-slate-100 flex items-center gap-1.5 uppercase tracking-wider">
                <Sparkles className="w-3.5 h-3.5 text-brand-500" />
                Customize Query with Local AI (Ollama)
              </span>
              {aiQueryExplanation && (
                <span className="text-[11px] text-teal-700 dark:text-teal-300 font-semibold truncate max-w-md">
                  ✨ {aiQueryExplanation}
                </span>
              )}
            </div>
            <form onSubmit={handleAIQueryCustomizationSubmit} className="flex items-center gap-2">
              <input
                type="text"
                value={aiQueryInstruction}
                onChange={(e) => setAiQueryInstruction(e.target.value)}
                placeholder="e.g. 'Focus on creative advertising agencies', 'Exclude interns & freshers', 'Include packaging design', 'Make broader'..."
                disabled={aiQueryCustomizing}
                className="flex-1 px-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-surface-darkBorder bg-white dark:bg-surface-darkBg text-navy-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
              />
              <button
                type="submit"
                disabled={aiQueryCustomizing || !aiQueryInstruction.trim()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-xs font-semibold shadow-xs transition-colors shrink-0"
              >
                {aiQueryCustomizing ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Applying...</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-3.5 h-3.5" />
                    <span>Apply AI Instruction</span>
                  </>
                )}
              </button>
            </form>

            {/* Editable AI-Interpreted Sourcing Suggestions */}
            {aiSuggestions && (
              <div className="mt-2 pt-2.5 border-t border-brand-200/60 dark:border-surface-darkBorder space-y-2.5 text-[11px]">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold text-slate-600 dark:text-slate-300">
                    {aiStatusNotice || 'Review & edit interpreted terms before regenerating:'}
                  </span>
                  <button
                    type="button"
                    onClick={handleApplyEditedSuggestions}
                    disabled={aiQueryCustomizing}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-semibold transition-colors"
                  >
                    <Check className="w-3 h-3" />
                    <span>Regenerate Query from Edits</span>
                  </button>
                </div>

                {aiValidationWarnings.length > 0 && (
                  <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200">
                    {aiValidationWarnings.join(' ')}
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  {[
                    { key: 'titles', label: 'Job Titles' },
                    { key: 'mandatory_skills', label: 'Mandatory Skills' },
                    { key: 'related_skills', label: 'Related / Alternative Skills' },
                    { key: 'industries', label: 'Industries' },
                    { key: 'exclusions', label: 'Exclusions (NOT)' },
                  ].map((group) => (
                    <div key={group.key} className="p-2 rounded-lg bg-white/80 dark:bg-surface-darkBg border border-slate-200/80 dark:border-surface-darkBorder space-y-1.5">
                      <span className="font-bold text-slate-700 dark:text-slate-200">{group.label}</span>
                      <div className="flex flex-wrap gap-1">
                        {(aiSuggestions[group.key] || []).map((chip, idx) => (
                          <span key={idx} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200">
                            <span>{chip}</span>
                            <button type="button" onClick={() => removeSuggestionChip(group.key, idx)} className="text-slate-400 hover:text-rose-500">
                              <X className="w-2.5 h-2.5" />
                            </button>
                          </span>
                        ))}
                      </div>
                      <div className="flex gap-1">
                        <input
                          type="text"
                          value={newSuggestionChip[group.key] || ''}
                          onChange={(e) => setNewSuggestionChip((prev) => ({ ...prev, [group.key]: e.target.value }))}
                          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addSuggestionChip(group.key); } }}
                          placeholder={`Add ${group.label.toLowerCase()}...`}
                          className="flex-1 px-2 py-0.5 rounded border border-slate-200 dark:border-surface-darkBorder bg-transparent text-[11px]"
                        />
                        <button type="button" onClick={() => addSuggestionChip(group.key)} className="px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-700 font-semibold">
                          +
                        </button>
                      </div>
                    </div>
                  ))}

                  <div className="p-2 rounded-lg bg-white/80 dark:bg-surface-darkBg border border-slate-200/80 dark:border-surface-darkBorder space-y-1.5">
                    <span className="font-bold text-slate-700 dark:text-slate-200">Experience &amp; Location</span>
                    <div className="grid grid-cols-2 gap-1.5">
                      <input
                        type="text"
                        value={aiSuggestions.experience_preference || ''}
                        onChange={(e) => setAiSuggestions((prev) => ({ ...prev, experience_preference: e.target.value }))}
                        placeholder="Experience (e.g. 5+ yrs)"
                        className="px-2 py-1 rounded border border-slate-200 dark:border-surface-darkBorder bg-transparent text-[11px]"
                      />
                      <input
                        type="text"
                        value={aiSuggestions.location_preference || ''}
                        onChange={(e) => setAiSuggestions((prev) => ({ ...prev, location_preference: e.target.value }))}
                        placeholder="Location (e.g. Bangalore)"
                        className="px-2 py-1 rounded border border-slate-200 dark:border-surface-darkBorder bg-transparent text-[11px]"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Generated or Custom Boolean Code Box */}
          <div className="relative group">
            {isCustomMode ? (
              <textarea
                ref={queryInputRef}
                value={customQueryText}
                onChange={(e) => setCustomQueryText(e.target.value)}
                placeholder="Type or edit your custom boolean search expression..."
                rows={4}
                className="w-full p-4 rounded-xl bg-slate-900 dark:bg-black border-2 border-brand-500/70 text-slate-100 font-mono text-[13px] sm:text-sm leading-relaxed shadow-inner focus:outline-none focus:ring-2 focus:ring-brand-500/30 resize-y"
              />
            ) : (
              <div
                onClick={() => {
                  setCustomQueryText(autoBooleanQuery);
                  setIsCustomMode(true);
                }}
                title="Click to customize / edit query"
                className="p-4 rounded-xl bg-slate-900 dark:bg-black border border-slate-800 dark:border-surface-darkBorder text-slate-200 font-mono text-[13px] sm:text-sm break-words select-all leading-relaxed shadow-inner pr-20 cursor-pointer hover:border-slate-700 transition-colors"
              >
                {activeBooleanQuery ? (
                  activeBooleanQuery
                    .split(/(\bAND\b|\bOR\b|\bNOT\b|\bsite:linkedin\.com\/in\b)/g)
                    .map((token, i) => {
                      if (token === 'AND') {
                        return (
                          <span key={i} className="text-emerald-400 font-bold px-1">
                            AND
                          </span>
                        );
                      }
                      if (token === 'OR') {
                        return (
                          <span key={i} className="text-amber-400 font-bold px-1">
                            OR
                          </span>
                        );
                      }
                      if (token === 'NOT') {
                        return (
                          <span key={i} className="text-rose-400 font-bold px-1">
                            NOT
                          </span>
                        );
                      }
                      if (token === 'site:linkedin.com/in') {
                        return (
                          <span key={i} className="text-indigo-400 font-bold pr-1">
                            site:linkedin.com/in
                          </span>
                        );
                      }
                      return <span key={i}>{token}</span>;
                    })
                ) : (
                  <span className="text-slate-500 italic">
                    Add required skills or select job criteria to generate a query.
                  </span>
                )}
              </div>
            )}

            <button
              type="button"
              onClick={() => handleCopyBoolean()}
              className="absolute right-3 top-3 opacity-90 hover:opacity-100 p-2 rounded-lg bg-slate-800/90 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all text-xs flex items-center gap-1.5 shadow-sm"
              title="Copy active query"
            >
              {copiedBoolean ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">{copiedBoolean ? 'Copied' : 'Copy'}</span>
            </button>
          </div>

          {/* Quick Snippet Copy Shortcuts & Sourcing Guidance */}
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs sm:text-sm text-slate-600 dark:text-slate-300 pt-1">
            <div className="flex flex-wrap items-center gap-3">
              <span>
                <strong className="text-navy-900 dark:text-slate-100 font-bold">Exp Filter:</strong>{' '}
                {job.experienceRequired || job.experienceRange || 'Any'}
              </span>
              <span>•</span>
              <span>
                <strong className="text-navy-900 dark:text-slate-100 font-bold">Location:</strong>{' '}
                {job.location || 'Any (Pan India / Remote)'}
              </span>
              <span>•</span>
              <span>
                <strong className="text-navy-900 dark:text-slate-100 font-bold">Department:</strong>{' '}
                {job.department || 'General'}
              </span>
            </div>

            {/* Quick Sourcing Snippet Copy Shortcuts */}
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => {
                  const skills = (job.requiredSkills || []).map((s) => (/\s/.test(s) ? `"${s}"` : s)).join(' AND ');
                  handleCopyBoolean(skills);
                }}
                className="text-xs sm:text-sm font-semibold text-brand-700 dark:text-brand-400 hover:underline"
              >
                Copy Skills Only
              </button>
              <span>•</span>
              <button
                type="button"
                onClick={() => {
                  const companies = selectedCompanies.length > 0 ? selectedCompanies : allCompanies.slice(0, 4);
                  const str = companies.map((c) => `"${c}"`).join(' OR ');
                  handleCopyBoolean(`(${str})`);
                }}
                className="text-xs sm:text-sm font-semibold text-indigo-700 dark:text-indigo-400 hover:underline"
              >
                Copy Target Companies
              </button>
            </div>
          </div>

          {/* Intelligent Keyword Recommendations */}
          <div className="pt-3.5 border-t border-slate-100 dark:border-surface-darkBorder space-y-2.5">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-brand-600 dark:text-brand-400" />
                <span className="text-sm font-bold text-navy-950 dark:text-slate-100 uppercase tracking-wider">
                  Suggested Relatable Keywords
                </span>
                <span className="text-xs font-mono font-semibold text-brand-700 dark:text-brand-300 bg-brand-50 dark:bg-brand-950/60 px-2.5 py-0.5 rounded-full border border-brand-200 dark:border-brand-800">
                  {suggestedKeywords.length} adjacent tools
                </span>
              </div>
              {suggestedKeywords.length > 0 && (
                <button
                  type="button"
                  onClick={handleAddAllSuggestedKeywords}
                  className="text-xs sm:text-sm font-semibold text-brand-700 dark:text-brand-400 hover:text-brand-800 dark:hover:text-brand-300 hover:underline"
                >
                  + Add All Suggestions to Query
                </button>
              )}
            </div>

            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
              Click any adjacent skill or tool to automatically append into your Boolean search string:
            </p>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              {suggestedKeywords.length === 0 ? (
                <span className="text-sm text-slate-400 italic">All suggested keywords are already included in your query.</span>
              ) : (
                suggestedKeywords.map((item, idx) => {
                  const kw = typeof item === 'string' ? item : item.skill;
                  const relType = item.relationship_type || 'related_adjacent';
                  const note = item.note || `Suggested adjacent skill for ${job.title}`;
                  const provLabel = relType === 'explicit_jd' ? 'Explicit JD' : relType === 'alias_equivalent' ? 'Equivalent' : 'Adjacent';
                  const provColor = relType === 'explicit_jd'
                    ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                    : relType === 'alias_equivalent'
                    ? 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300'
                    : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300';

                  return (
                    <button
                      key={kw || idx}
                      type="button"
                      onClick={() => handleAddKeywordToQuery(item)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs sm:text-sm font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200/90 dark:border-emerald-800 hover:bg-emerald-100 hover:border-emerald-300 dark:hover:bg-emerald-900/50 transition-all shadow-2xs active:scale-95"
                      title={note}
                    >
                      <Plus className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      <span>{kw}</span>
                      <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-medium ${provColor}`}>
                        {provLabel}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Relatable Stored Job Descriptions (Dynamic Match While Customizing) */}
          {relatableJDs.length > 0 && (
            <div className="pt-3.5 border-t border-slate-100 dark:border-surface-darkBorder space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <Briefcase className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <span className="text-sm font-bold text-navy-950 dark:text-slate-100 uppercase tracking-wider">
                    Relatable Stored Job Descriptions
                  </span>
                  <span className="text-xs font-mono font-semibold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 px-2.5 py-0.5 rounded-full border border-indigo-200 dark:border-indigo-800">
                    {relatableJDs.length} live matches
                  </span>
                </div>
                <span className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 hidden sm:inline">
                  Dynamic semantic overlap based on query keywords &amp; tech stack
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {relatableJDs.map(({ otherJob, relevanceScore, matchedSkills }) => (
                  <div
                    key={otherJob.id}
                    className="p-3.5 bg-slate-50/80 dark:bg-surface-darkBg border border-slate-200/80 dark:border-surface-darkBorder rounded-xl space-y-2 hover:border-indigo-300 dark:hover:border-indigo-600 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-1.5">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1 mb-0.5">
                          <span className="font-mono text-[9px] font-semibold text-slate-500 dark:text-slate-400 bg-white dark:bg-surface-darkCard px-1.5 py-0.2 rounded border border-slate-200 dark:border-surface-darkBorder">
                            {otherJob.jdCode}
                          </span>
                        </div>
                        <h5 className="text-xs font-bold text-navy-900 dark:text-slate-100 truncate" title={otherJob.title}>
                          {otherJob.title}
                        </h5>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">{otherJob.department || 'General'}</p>
                      </div>
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 flex-shrink-0">
                        {relevanceScore}%
                      </span>
                    </div>

                    {matchedSkills.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1 text-[10px]">
                        {matchedSkills.map((sk, idx) => (
                          <span
                            key={idx}
                            className="px-1.5 py-0.2 rounded bg-white dark:bg-surface-darkCard text-slate-600 dark:text-slate-300 border border-slate-200/80 dark:border-surface-darkBorder text-[9px]"
                          >
                            {sk}
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-1 border-t border-slate-200/60 dark:border-surface-darkBorder text-[11px]">
                      <button
                        type="button"
                        onClick={() => handleMergeJDSkills(otherJob)}
                        className="inline-flex items-center gap-1 font-semibold text-brand-700 dark:text-brand-400 hover:text-brand-800 dark:hover:text-brand-300 hover:underline"
                        title="Merge unique skills from this JD into your query"
                      >
                        <GitMerge className="w-3 h-3" />
                        <span>Merge Skills</span>
                      </button>

                      {onSelectJob && (
                        <button
                          type="button"
                          onClick={() => onSelectJob(otherJob.id)}
                          className="inline-flex items-center gap-1 font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 hover:underline"
                          title={`Switch view to ${otherJob.title}`}
                        >
                          <span>Inspect JD</span>
                          <ArrowUpRight className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
            </div>
          )}
        </div>
      )}

      {/* 5.5. AI Talent Intelligence Section */}
      {shouldShowSection('aiIntelligence') && (
        <div className="rounded-2xl border border-slate-200/90 dark:border-surface-darkBorder bg-white dark:bg-surface-darkCard shadow-subtle overflow-hidden transition-all">
          <div className="w-full flex items-center justify-between p-4 hover:bg-slate-50/70 dark:hover:bg-slate-800/50 transition-colors flex-wrap gap-2">
            <button
              type="button"
              onClick={() => toggleSection('aiIntelligence')}
              className="flex-1 flex items-center gap-3 text-left min-w-[200px]"
            >
              <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200/80 dark:border-indigo-800 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shadow-subtle flex-shrink-0">
                <Database className="w-4 h-4" />
              </div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h4 className="text-sm font-bold uppercase tracking-wider text-navy-900 dark:text-slate-100">
                  AI Talent Intelligence
                </h4>
                <span className="text-xs font-semibold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 px-2.5 py-0.5 rounded-full border border-indigo-200/70 dark:border-indigo-800">
                  Live Nemotron Insights
                </span>
              </div>
            </button>
            {/* Quick Header Actions */}
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => toggleSection('aiIntelligence')}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                aria-label="Toggle AI intelligence section"
              >
                <ChevronDown
                  className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${
                    openSections.aiIntelligence ? 'rotate-180' : ''
                  }`}
                />
              </button>
            </div>
          </div>

          {openSections.aiIntelligence && (
            <div className="p-0 animate-fadeIn">
              <AIIntelligencePanel
                jobId={job.numeric_id || job.id}
                job={job}
                onOpenSourcingTab={() => {
                  setActiveViewFilter('sourcing');
                  setOpenSections((prev) => ({ ...prev, companies: true, boolean: true }));
                }}
                onNavigateToJob={(targetJobId) => {
                  if (onNavigateToJob) onNavigateToJob(targetJobId);
                }}
              />
            </div>
          )}
        </div>
      )}

      {/* 5. Job Posting & Distribution Workspace */}
      {shouldShowSection('jobPosting') && (
        <div className="rounded-2xl border border-slate-200/90 dark:border-surface-darkBorder bg-white dark:bg-surface-darkCard shadow-subtle overflow-hidden">
          <button
            type="button"
            onClick={() => toggleSection('jobPosting')}
            className="w-full flex items-center justify-between p-4 hover:bg-slate-50/70 dark:hover:bg-slate-800/50 transition-colors text-left"
          >
            <span className="flex items-center gap-3">
              <span className="w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700">
                <Send className="w-4 h-4" />
              </span>
              <span>
                <span className="block text-sm font-bold uppercase tracking-wider text-navy-900 dark:text-slate-100">
                  Ready-to-Publish Job Advertisements
                </span>
                <span className="block text-xs text-slate-500">Formatted for LinkedIn, Indeed, Naukri &amp; Company Careers</span>
              </span>
            </span>
            <ChevronDown className={`w-4 h-4 transition-transform ${openSections.jobPosting ? 'rotate-180' : ''}`} />
          </button>
          {openSections.jobPosting && (
            <JobPostingWorkspace job={job} />
          )}
        </div>
      )}

      {/* 6. Matching Candidates Section */}
      {shouldShowSection('matches') && (
        <div className="rounded-2xl border border-slate-200/90 dark:border-surface-darkBorder bg-white dark:bg-surface-darkCard shadow-subtle overflow-hidden transition-all">
          <div className="w-full flex items-center justify-between p-4 hover:bg-slate-50/70 dark:hover:bg-slate-800/50 transition-colors flex-wrap gap-2">
            <button
              type="button"
              onClick={() => toggleSection('matches')}
              className="flex-1 flex items-center gap-3 text-left min-w-[200px]"
            >
              <div className="w-8 h-8 rounded-xl bg-navy-900 dark:bg-slate-800 flex items-center justify-center text-white shadow-subtle flex-shrink-0">
                <Users className="w-4 h-4 text-brand-300" />
              </div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h4 className="text-sm font-bold uppercase tracking-wider text-navy-900 dark:text-slate-100">
                  Best Matched Candidates from Database
                </h4>
                {matchingCandidates.length > 0 && (
                  <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-0.5 rounded-full border border-emerald-200/70 dark:border-emerald-800">
                    {matchingCandidates.length} Candidates • Top Match: {Math.max(...matchingCandidates.map((c) => c.matchScore || c.match_score || 0))}%
                  </span>
                )}
              </div>
            </button>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenMatrix?.(job);
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs sm:text-sm font-semibold transition-colors shadow-subtle"
              >
                <span>Open Matching Matrix</span>
                <ChevronDown className="w-4 h-4 -rotate-90 text-slate-400 dark:text-slate-400" />
              </button>

              <button
                type="button"
                onClick={() => toggleSection('matches')}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                aria-label="Toggle matching candidates section"
              >
                <ChevronDown
                  className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${
                    openSections.matches ? 'rotate-180' : ''
                  }`}
                />
              </button>
            </div>
          </div>

          {openSections.matches && (
            <div className="p-5 pt-1 border-t border-slate-100 dark:border-surface-darkBorder animate-fadeIn space-y-4">
              {/* Recruiter Friendly Tip */}
              <div className="recruiter-tip">
                <Users className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                <span><strong>Matching Guide:</strong> Candidates with scores &ge; 75% are strong fits for immediate phone screening. Click on any profile to review detailed skill comparisons.</span>
              </div>

              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                Candidates automatically evaluated and ranked by overall skills match, experience level, and role requirements.
              </p>

              {/* Matching KPIs Header Summary Cards */}
              {matchingCandidates.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3.5 bg-slate-50 dark:bg-surface-darkBg border border-slate-200/80 dark:border-surface-darkBorder rounded-xl">
                    <span className="text-xs uppercase font-bold text-slate-500 dark:text-slate-400 block tracking-wider mb-1">Evaluated Pool</span>
                    <span className="text-xl font-extrabold text-navy-900 dark:text-slate-100">{matchingCandidates.length}</span>
                    <span className="text-xs text-slate-500 dark:text-slate-400 block mt-0.5">candidates</span>
                  </div>
                  <div className="p-3.5 bg-emerald-50/60 dark:bg-surface-darkBg border border-emerald-200/60 dark:border-emerald-900/60 rounded-xl">
                    <span className="text-xs uppercase font-bold text-emerald-700 dark:text-emerald-400 block tracking-wider mb-1">Top Matches</span>
                    <span className="text-xl font-extrabold text-emerald-800 dark:text-emerald-300">
                      {scoredMatchValues.filter((score) => score >= 75).length}
                    </span>
                    <span className="text-xs text-emerald-600 dark:text-emerald-400/80 block mt-0.5">score &ge; 75%</span>
                  </div>
                  <div className="p-3.5 bg-brand-50/60 dark:bg-surface-darkBg border border-brand-200/60 dark:border-brand-900/60 rounded-xl">
                    <span className="text-xs uppercase font-bold text-brand-700 dark:text-brand-400 block tracking-wider mb-1">Average Fit</span>
                    <span className="text-xl font-extrabold text-brand-900 dark:text-brand-300">
                      {scoredMatchValues.length
                        ? `${Math.round(scoredMatchValues.reduce((sum, score) => sum + score, 0) / scoredMatchValues.length)}%`
                        : 'Insufficient Evidence'}
                    </span>
                    <span className="text-xs text-brand-600 dark:text-brand-400/80 block mt-0.5">across pool</span>
                  </div>
                  <div className="p-3.5 bg-blue-50/60 dark:bg-surface-darkBg border border-blue-200/60 dark:border-blue-900/60 rounded-xl">
                    <span className="text-xs uppercase font-bold text-blue-700 dark:text-blue-400 block tracking-wider mb-1">Top Score</span>
                    <span className="text-xl font-extrabold text-blue-900 dark:text-blue-300">
                      {scoredMatchValues.length ? `${Math.max(...scoredMatchValues)}%` : 'Insufficient Evidence'}
                    </span>
                    <span className="text-xs text-blue-600 dark:text-blue-400/80 block mt-0.5">highest rank</span>
                  </div>
                </div>
              )}

              {/* Instant In-Pool Candidate Keyword Search */}
              <div className="space-y-2 pt-1">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
                  <input
                    type="text"
                    value={candidateKeywordFilter}
                    onChange={(e) => setCandidateKeywordFilter(e.target.value)}
                    placeholder="Search candidate name, role, skills across pool & database (e.g. Oracle, Hyperion, PBCS)..."
                    className="w-full pl-10 pr-9 py-2.5 bg-slate-50 dark:bg-surface-darkBg border border-slate-200/90 dark:border-surface-darkBorder rounded-xl text-sm text-navy-950 dark:text-slate-100 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-all placeholder:text-slate-400"
                  />
                  {candidateKeywordFilter && (
                    <button
                      type="button"
                      onClick={() => setCandidateKeywordFilter('')}
                      className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 rounded"
                      title="Clear keyword search"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {isLoadingMatches ? (
                  <div className="flex items-center gap-2 text-xs sm:text-sm text-slate-500 px-1 py-1">
                    <span className="w-4 h-4 rounded-full border-2 border-brand-500 border-t-transparent animate-spin" />
                    <span>Evaluating candidate match scoring for this role...</span>
                  </div>
                ) : candidateKeywordFilter ? (
                  <div className="flex items-center justify-between text-xs sm:text-sm text-slate-600 dark:text-slate-300 px-1">
                    <span>
                      Filtered <strong className="text-navy-950 dark:text-slate-100 font-bold">{filteredMatchingCandidates.length}</strong> {filteredMatchingCandidates.length === 1 ? 'candidate' : 'candidates'} matching "<span className="text-teal-700 dark:text-teal-400 font-semibold">{candidateKeywordFilter}</span>"
                      {allCandidates.length > 0 && (
                        <span className="ml-1.5 text-slate-400 font-normal">
                          (from {matchingCandidates.length} evaluated &amp; {allCandidates.length} DB talent pool candidates)
                        </span>
                      )}
                    </span>
                    <button
                      type="button"
                      onClick={() => setCandidateKeywordFilter('')}
                      className="text-brand-600 dark:text-brand-400 hover:underline font-semibold"
                    >
                      Clear filter
                    </button>
                  </div>
                ) : null}
              </div>

              <MatchingCandidates
                job={job}
                candidates={filteredMatchingCandidates}
                onSelectCandidate={onSelectCandidate}
                onOpenWorkspace={() => onOpenMatrix?.(job)}
                onCompareCandidate={onCompareWithCandidate}
              />
            </div>
          )}
        </div>
      )}

      <MarketReportModal
        isOpen={showMarketReportModal}
        onClose={() => setShowMarketReportModal(false)}
        job={job}
        hasTargetCompanies={allCompanies.length > 0}
      />
    </div>
  );
};
