// Import React for JSX structure and local approval notice state.
import React, { useState, useMemo, useEffect, useRef } from 'react';

// Import Badge and CustomSelect components for skills, status pills, and beautified dropdowns.
import { Badge } from '../common/Badge';
import { CustomSelect } from '../common/CustomSelect';

// Import MatchingCandidates subcomponent.
import { MatchingCandidates } from './MatchingCandidates';

// Import approvalApi for JD approval submission.
import { approvalApi } from '../../api/client';

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
  Layers,
  Tag,
  ArrowUpRight,
  Info,
  HelpCircle,
  Maximize2,
  Minimize2,
} from 'lucide-react';

// Sourcing Company Categories with visual styles and icons
export const COMPANY_CATEGORIES = [
  { id: 'all', label: 'All Companies', icon: Building2 },
  { id: 'oem', label: 'Product & OEMs', icon: Crown, color: 'text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200/80 dark:border-emerald-800' },
  { id: 'big4', label: 'Big 4 & Advisory', icon: Building, color: 'text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 border-blue-200/80 dark:border-blue-800' },
  { id: 'gsi', label: 'Global System Integrators', icon: Globe, color: 'text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/60 border-purple-200/80 dark:border-purple-800' },
  { id: 'gcc', label: 'Enterprise GCCs & Hubs', icon: Target, color: 'text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 border-amber-200/80 dark:border-amber-800' },
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

// Skill and technology adjacency knowledge catalog matching the backend taxonomy service.
const SKILL_ADJACENCY_CATALOG = {
  // Oracle & Enterprise EPM / ERP
  'oracle epm': ['Oracle FCCS', 'Smart View', 'Hyperion Financial Management', 'Essbase', 'Calculation Manager', 'PBCS', 'Financial Consolidation', 'Data Integration', 'Groovy Rules', 'EPM Automate'],
  'hyperion planning': ['Oracle EPM', 'Essbase', 'Smart View', 'Calculation Scripts', 'Dimension Hierarchies', 'PBCS', 'Financial Consolidation', 'FDMEE', 'EPM Automate'],
  'pbcs': ['Oracle EPM', 'Hyperion Planning', 'Calculation Scripts', 'Dimension Hierarchies', 'Smart View', 'Essbase', 'Data Management', 'Business Rules'],
  'oracle fccs': ['Oracle EPM', 'Financial Consolidation', 'Smart View', 'Hyperion Financial Management', 'HFM', 'Financial Close', 'Intercompany Eliminations'],
  'smart view': ['Oracle EPM', 'Hyperion Planning', 'Essbase', 'Oracle FCCS', 'Financial Reporting', 'Ad-hoc Analysis'],
  'essbase': ['Hyperion Planning', 'Calculation Scripts', 'MaxL', 'ASO / BSO', 'Smart View', 'Oracle EPM', 'Outline Load Utility'],

  // Siemens & PLM
  'siemens teamcenter': ['BMIDE', 'Active Workspace', 'AWC', 'ITK', 'Teamcenter PLM', 'CAD Integration', 'Workflow Handlers', 'Dispatcher'],
  'teamcenter': ['BMIDE', 'Active Workspace', 'ITK', 'Teamcenter PLM', 'Siemens PLM', 'Workflow Handlers', 'Dispatcher'],
  'bmide': ['Siemens Teamcenter', 'Active Workspace', 'ITK', 'Data Modeling', 'Schema Extension'],
  'active workspace': ['Siemens Teamcenter', 'BMIDE', 'AWC', 'JavaScript', 'HTML5', 'Teamcenter Architecture'],

  // SAP Ecosystem
  'sap': ['SAP CPI', 'Integration Suite', 'SAP S/4HANA', 'ABAP', 'IDoc', 'BAPI', 'REST APIs', 'SAP PI/PO'],
  'sap cpi': ['Integration Suite', 'SAP PI/PO', 'Groovy Scripts', 'XSLT', 'Cloud Platform Integration', 'SAP S/4HANA', 'OData', 'BAPI'],
  'sap security': ['GRC Access Control', 'S/4HANA Security', 'Fiori Security', 'Role Design', 'SOD Analysis', 'PFCG'],

  // Java & Backend
  'java': ['Spring Boot', 'Microservices', 'REST APIs', 'Hibernate', 'Kafka', 'Docker', 'Kubernetes', 'SQL', 'Maven'],
  'spring boot': ['Java', 'Microservices', 'REST APIs', 'Hibernate', 'Docker', 'Kubernetes', 'JPA', 'PostgreSQL'],
  'microservices': ['Spring Boot', 'Docker', 'Kubernetes', 'REST APIs', 'Kafka', 'AWS', 'API Gateway'],

  // .NET
  '.net': ['C#', 'ASP.NET Core', 'SQL Server', 'Azure', 'Microservices', 'Entity Framework', 'REST APIs'],
  'c#': ['.NET', 'ASP.NET Core', 'SQL Server', 'Azure', 'LINQ'],

  // Python & AI
  'python': ['FastAPI', 'Django', 'SQLAlchemy', 'Docker', 'Pandas', 'PostgreSQL', 'AWS', 'PyTorch'],
  'fastapi': ['Python', 'Pydantic', 'SQLAlchemy', 'Docker', 'PostgreSQL', 'AsyncIO', 'REST APIs'],

  // Testing & QA
  'selenium': ['Automation Testing', 'Java', 'Python', 'TestNG', 'Cucumber', 'Page Object Model', 'API Testing'],
  'automation testing': ['Selenium', 'Playwright', 'Cypress', 'API Testing', 'Java', 'Python', 'CI/CD'],

  // Cloud & DevOps
  'aws': ['Docker', 'Kubernetes', 'Terraform', 'CI/CD', 'Lambda', 'EC2', 'CloudFormation'],
  'azure': ['Docker', 'Kubernetes', 'CI/CD', 'Azure DevOps', 'Terraform', '.NET'],
  'docker': ['Kubernetes', 'CI/CD', 'AWS', 'Linux', 'Containers', 'Microservices'],
  'kubernetes': ['Docker', 'Helm', 'CI/CD', 'AWS', 'EKS', 'Microservices'],
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
  onUpdateJob,
  onOpenSegmentation,
  onOpenMatrix,
  onRefreshApprovals,
  isFullPageView = false,
  onToggleFullPageView,
}) => {
  const [approvalSentMsg, setApprovalSentMsg] = useState('');
  const [naukriStrictAnd, setNaukriStrictAnd] = useState(true);
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
  const [companySearchQuery, setCompanySearchQuery] = useState('');
  const [customCompanies, setCustomCompanies] = useState([]);
  const [customCompanyInput, setCustomCompanyInput] = useState('');
  const [customCompanyCategory, setCustomCompanyCategory] = useState('gsi');
  const [customCompanyLocation, setCustomCompanyLocation] = useState('');
  const [showAddCompanyInput, setShowAddCompanyInput] = useState(false);
  const [copiedBoolean, setCopiedBoolean] = useState(false);
  const [copiedTargetClause, setCopiedTargetClause] = useState(false);
  const [copiedExcludedClause, setCopiedExcludedClause] = useState(false);

  // Custom Query Editor state
  const [isCustomMode, setIsCustomMode] = useState(false);
  const [customQueryText, setCustomQueryText] = useState('');
  const queryInputRef = useRef(null);

  // Copied state for Interview Kit
  const [copiedKit, setCopiedKit] = useState(false);

  // Collapsible section state for executive focus & clutter reduction
  const [openSections, setOpenSections] = useState({
    summary: true, // open in detailed JD Specifications
    competencies: true, // open in detailed JD Specifications
    screeningKit: true, // open in detailed JD Specifications
    companies: true, // open in Talent Sourcing
    boolean: true, // open in Talent Sourcing
    matches: true, // open in Candidate Matching
  });

  // Scope Tab: 'structured' | 'original'
  const [scopeTab, setScopeTab] = useState('structured');

  // Active view tab filter: 'specifications' | 'sourcing' | 'candidates' (Default to JD Specifications)
  const [activeViewFilter, setActiveViewFilter] = useState('specifications');

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
    setCopiedBoolean(false);
    setCopiedTargetClause(false);
    setCopiedExcludedClause(false);
    setIsCustomMode(false);
    setCustomQueryText('');
    setCandidateKeywordFilter('');
  }, [job?.id]);

  // Derive JD-related target sourcing companies from the job's title, department & skill stack.
  const relatedCompanyObjects = useMemo(() => {
    if (!job) return [];
    const haystack = [
      job.title || '',
      job.department || '',
      job.description || '',
      ...(job.requiredSkills || []),
      ...(job.preferredSkills || []),
    ]
      .join(' ')
      .toLowerCase();

    const matchedMap = new Map();
    STACK_COMPANY_ECOSYSTEMS.forEach((group) => {
      if (group.keywords.some((kw) => haystack.includes(kw))) {
        group.companies.forEach((co) => {
          if (!matchedMap.has(co.name)) {
            matchedMap.set(co.name, co);
          }
        });
      }
    });

    if (matchedMap.size === 0) {
      DEFAULT_COMPANY_ECOSYSTEM.companies.forEach((co) => {
        matchedMap.set(co.name, co);
      });
    }

    return Array.from(matchedMap.values());
  }, [job]);

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

  // Filtered company objects based on active category tab & search query
  const filteredCompanyObjects = useMemo(() => {
    let list = allCompanyObjects;
    if (companyCategoryFilter !== 'all') {
      list = list.filter((c) => c.category === companyCategoryFilter);
    }
    if (companySearchQuery.trim()) {
      const q = companySearchQuery.trim().toLowerCase();
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          (c.location && c.location.toLowerCase().includes(q)) ||
          (c.tier && c.tier.toLowerCase().includes(q)) ||
          (c.description && c.description.toLowerCase().includes(q))
      );
    }
    return list;
  }, [allCompanyObjects, companyCategoryFilter, companySearchQuery]);

  // Generate tailored technical interview screening questions and evaluation scorecard from JD
  const screeningKit = useMemo(() => {
    if (!job) return { questions: [], greenFlags: [], redFlags: [] };

    const skills = job.requiredSkills || [];
    const preferred = job.preferredSkills || [];
    const primarySkill = skills[0] || job.title || 'Core Tech Stack';
    const secondarySkill = skills[1] || preferred[0] || 'System Architecture';
    const tertiarySkill = skills[2] || preferred[1] || 'Integration & Testing';

    const questions = [
      {
        id: 'q1',
        category: 'Architecture & Implementation',
        question: `Can you walk through your hands-on experience designing and delivering enterprise solutions using ${primarySkill}? What was the most complex workflow, calculation, or configuration you owned end-to-end?`,
        expectedAnswer: `Look for concrete configuration details, specific tool versions/modules used, and genuine hands-on ownership rather than high-level consulting buzzwords.`,
        skillTag: primarySkill,
      },
      {
        id: 'q2',
        category: 'Practical Problem Solving & Tuning',
        question: `When working with ${secondarySkill}, how do you approach performance tuning, script optimization, or resolving production discrepancies under tight deadlines?`,
        expectedAnswer: `Candidate should outline systematic debugging methodology, log analysis, isolated test environments, and proactive root-cause prevention.`,
        skillTag: secondarySkill,
      },
      {
        id: 'q3',
        category: 'Integration & Governance',
        question: `In projects involving ${tertiarySkill}, how do you ensure seamless data consistency, error handling, and alignment with client/business stakeholders?`,
        expectedAnswer: `Demonstrates end-to-end SDLC lifecycle maturity, release governance, and cross-functional team coordination.`,
        skillTag: tertiarySkill,
      },
    ];

    const greenFlags = [
      `Hands-on production delivery with ${skills.slice(0, 3).join(', ') || 'the core tech stack'}`,
      `Quantifiable project impact (e.g., performance tuning, automated business cycles, reduced errors)`,
      `Clear, structured articulation of architectural trade-offs and configuration decisions`,
      `Demonstrates familiarity with modern best practices, version upgrades, and integration testing`,
    ];

    const redFlags = [
      `Generic resume buzzwords without ability to explain underlying configuration or code logic`,
      `Claiming lead/senior seniority without hands-on scripting, debugging, or troubleshooting ownership`,
      `Frequent short tenures without demonstrating project lifecycle completion`,
      `Inability to explain why a specific architecture or tool was selected over alternatives`,
    ];

    return { questions, greenFlags, redFlags };
  }, [job]);

  const handleCopyInterviewKit = () => {
    if (!screeningKit) return;
    const text = [
      `📋 AI INTERVIEW SCREENING KIT: ${job?.title || 'Job Position'}`,
      `Department: ${job?.department || 'Engineering'} | Experience Level: ${job?.experience || '5-8 Years'} | Location: ${job?.location || 'Remote/Hybrid'}`,
      `Mandatory Competencies: ${(job?.requiredSkills || []).join(', ')}`,
      ``,
      `==================================================`,
      `1. CORE TECHNICAL SCREENING QUESTIONS`,
      `==================================================`,
      ...screeningKit.questions.map(
        (q, idx) =>
          `[Q${idx + 1}] (${q.category} • Target Skill: ${q.skillTag})\n${q.question}\n▶ What to look for (Expected Signals):\n${q.expectedAnswer}\n`
      ),
      `==================================================`,
      `2. CANDIDATE EVALUATION SCORECARD`,
      `==================================================`,
      `🟢 GREEN FLAGS (Strong Match Signals):`,
      ...screeningKit.greenFlags.map((gf) => `  ✓ ${gf}`),
      ``,
      `🔴 RED FLAGS (Watch-outs & Risks):`,
      ...screeningKit.redFlags.map((rf) => `  ⚠ ${rf}`),
    ].join('\n');

    navigator.clipboard?.writeText(text);
    setCopiedKit(true);
    setTimeout(() => setCopiedKit(false), 2000);
  };

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

    // If pre-computed AI Boolean query exists in intelligenceData and user hasn't enabled optional modifier flags:
    const hasModifierFlags = includePreferredInBoolean || includeCompaniesInBoolean || includeLocationInBoolean || includeNoticeInBoolean || includeSeniorityInBoolean || includeExclusionsInBoolean;
    const aiQueries = job.intelligenceData?.boolean_queries;
    if (aiQueries && !hasModifierFlags) {
      if (sourcingPlatform === 'keywords') {
        const kw = aiQueries.simple_keywords?.[keywordDelimiter] || formattedPlainKeywords;
        if (kw) return kw;
      } else if (sourcingPlatform === 'naukri' && aiQueries.naukri?.query) {
        return aiQueries.naukri.query;
      } else if (sourcingPlatform === 'linkedin' && aiQueries.linkedin?.query) {
        return aiQueries.linkedin.query;
      } else if (sourcingPlatform === 'xray' && aiQueries.google_xray?.query) {
        return aiQueries.google_xray.query;
      }
    }

    // If Plain Keywords mode is active, return formatted plain keywords string
    if (sourcingPlatform === 'keywords') {
      return formattedPlainKeywords;
    }

    const quote = (term) => {
      const cleaned = String(term || '').trim();
      if (!cleaned) return '';
      return /\s|[\/\-+&]/.test(cleaned) ? `"${cleaned}"` : cleaned;
    };

    const parts = [];

    // Title / Role keywords
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

    // Seniority / Lead focus (optional)
    if (includeSeniorityInBoolean) {
      parts.push('("Lead" OR "Senior" OR "Staff" OR "Principal" OR "Architect")');
    }

    // Mandatory Skills
    const mandatory = (job.requiredSkills || []).map(quote).filter(Boolean);
    if (mandatory.length > 0) {
      parts.push(`(${mandatory.join(naukriStrictAnd ? ' AND ' : ' OR ')})`);
    }

    // Preferred Skills (optional)
    if (includePreferredInBoolean) {
      const preferred = (job.preferredSkills || []).map(quote).filter(Boolean);
      if (preferred.length > 0) {
        parts.push(`(${preferred.join(' OR ')})`);
      }
    }

    // Target Companies (optional)
    const activeCompanies =
      selectedCompanies.length > 0 ? selectedCompanies : allCompanies.slice(0, 4);
    if (includeCompaniesInBoolean && activeCompanies.length > 0) {
      parts.push(`(${activeCompanies.map(quote).join(' OR ')})`);
    }

    // Location filter (optional)
    if (includeLocationInBoolean && job.location) {
      const locList = job.location
        .split(/[\/,]+/)
        .map((l) => l.trim())
        .filter((l) => l && !/india/i.test(l))
        .map(quote);
      if (locList.length > 0) {
        parts.push(`(${locList.join(' OR ')})`);
      }
    }

    // Immediate Notice booster (optional)
    if (includeNoticeInBoolean) {
      parts.push('("Immediate" OR "15 Days" OR "30 Days" OR "Serving Notice")');
    }

    let coreQuery = parts.join(' AND ');

    // Exclusion filter: drop interns, trainees, students, freshers (optional)
    if (includeExclusionsInBoolean) {
      coreQuery += ' NOT ("Intern" OR "Trainee" OR "Student" OR "Fresher")';
    }

    // Excluded companies (non-poach / off-limits protection)
    if (excludedCompanies.length > 0) {
      const excludedQuoted = excludedCompanies.map(quote).filter(Boolean);
      if (excludedQuoted.length > 0) {
        coreQuery += ` NOT (${excludedQuoted.join(' OR ')})`;
      }
    }

    if (sourcingPlatform === 'xray') {
      return `site:linkedin.com/in ${coreQuery}`;
    }

    return coreQuery;
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
    formattedPlainKeywords,
  ]);

  // Active query: user's custom edited string if in Custom Mode, otherwise AI auto-generated.
  const activeBooleanQuery = isCustomMode ? customQueryText : autoBooleanQuery;

  // Derive smart keyword suggestions from catalog based on JD skills & current query tokens
  const suggestedKeywords = useMemo(() => {
    if (!job) return [];
    const suggestions = new Set();
    const queryLower = (activeBooleanQuery || '').toLowerCase();

    const currentSkills = [
      ...(job.requiredSkills || []),
      ...(job.preferredSkills || []),
    ];

    const searchKeys = [
      ...currentSkills.map((s) => s.toLowerCase()),
      ...(job.title || '').toLowerCase().split(/[\s,/()]+/).filter((w) => w.length > 2),
    ];

    searchKeys.forEach((key) => {
      Object.entries(SKILL_ADJACENCY_CATALOG).forEach(([catKey, adjList]) => {
        if (key.includes(catKey) || catKey.includes(key)) {
          adjList.forEach((adj) => {
            if (!queryLower.includes(adj.toLowerCase())) {
              suggestions.add(adj);
            }
          });
        }
      });
    });

    return Array.from(suggestions).slice(0, 10);
  }, [job, activeBooleanQuery]);

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

  // Append a single recommended keyword to the query
  const handleAddKeywordToQuery = (keyword) => {
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
      .map((k) => (/\s|[\/\-+&]/.test(k) ? `"${k}"` : k))
      .join(' AND ');
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
  };

  const handleRemoveCustomCompany = (companyName, e) => {
    e?.stopPropagation();
    setCustomCompanies((prev) => prev.filter((c) => c.name.toLowerCase() !== companyName.toLowerCase()));
    setSelectedCompanies((prev) => prev.filter((c) => c !== companyName));
    setExcludedCompanies((prev) => prev.filter((c) => c !== companyName));
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

  // Track JD-synced vs recruiter-added provenance cleanly.
  const syncedMandatorySet = new Set(job.syncedMandatorySkills || []);

  // Render job detail view.
  return (
    <div className="bg-white dark:bg-surface-darkCard border border-slate-200/80 dark:border-surface-darkBorder rounded-2xl shadow-card p-6 space-y-6">
      {/* Header section with title, customizable status dropdown, and action triggers */}
      <div className="flex flex-col gap-4 pb-5 border-b border-slate-100 dark:border-surface-darkBorder">
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

          <h2 className="text-xl sm:text-2xl font-bold text-navy-900 dark:text-slate-100 tracking-tight">{job.title}</h2>

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
            className="flex items-center justify-center gap-2 px-3.5 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-all"
          >
            <Users className="w-4 h-4 text-white" />
            <span>Matching Workspace</span>
          </button>

          <button
            onClick={() => onOpenSegmentation?.(job)}
            className="flex items-center justify-center gap-2 px-3.5 py-2 bg-navy-900 dark:bg-slate-800 hover:bg-navy-950 text-white rounded-xl text-xs font-semibold shadow-sm transition-all"
          >
            <Sparkles className="w-4 h-4 text-brand-300" />
            <span>Requirements Workspace</span>
          </button>

          <button
            onClick={() => onAnalyzeJob(job)}
            className="flex items-center justify-center gap-2 px-3.5 py-2 bg-brand-50 dark:bg-brand-950/40 hover:bg-brand-100 text-brand-700 dark:text-brand-300 border border-brand-200/90 dark:border-brand-800 rounded-xl text-xs font-semibold shadow-subtle transition-all"
          >
            <Sparkles className="w-4 h-4 text-brand-600 dark:text-brand-400" />
            <span>Analyze Criteria</span>
          </button>

          <button
            type="button"
            onClick={handleProposeJobApproval}
            className="flex items-center justify-center gap-1.5 px-3 py-2 bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 rounded-xl text-xs font-semibold transition-all"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Submit Approval</span>
          </button>
        </div>
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
            { id: 'specifications', label: '1. JD Specifications', badge: 'Detailed Scope & Kit' },
            { id: 'sourcing', label: '2. Talent Sourcing', badge: 'Multi-Platform Boolean' },
            { id: 'candidates', label: '3. Candidates & Matching', badge: `${matchingCandidates.length} Evaluated` },
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
                  Job Summary &amp; Scope
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
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    {scopeTab === 'structured' ? '✨ Deep semantic synthesis' : '📄 Verbatim source audit'}
                  </span>
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
                  Required Competencies
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
                  AI Technical Screening &amp; Interview Kit
                </h4>
                <span className="text-xs font-semibold text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/60 px-2.5 py-0.5 rounded-full border border-teal-200/70 dark:border-teal-800">
                  {screeningKit.questions.length} Core Questions • Scorecard
                </span>
              </div>
            </button>

            {/* Quick Header Actions */}
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleCopyInterviewKit();
                }}
                className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-semibold shadow-subtle transition-all duration-150 ${
                  copiedKit
                    ? 'bg-emerald-600 text-white'
                    : 'bg-teal-700 hover:bg-teal-800 dark:bg-teal-600 dark:hover:bg-teal-700 text-white'
                }`}
                title="Copy complete interview questions and evaluation criteria"
              >
                {copiedKit ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                <span>{copiedKit ? 'Copied Kit!' : 'Copy Interview Kit'}</span>
              </button>

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
            <div className="p-5 pt-1 border-t border-slate-100 dark:border-surface-darkBorder animate-fadeIn space-y-4">
              {/* Role Alignment Summary Pill */}
              <div className="flex items-center justify-between flex-wrap gap-2 text-xs sm:text-sm p-3 rounded-xl bg-slate-50 dark:bg-surface-darkBg border border-slate-200/80 dark:border-surface-darkBorder">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-slate-500 dark:text-slate-400 font-semibold">Screening Target:</span>
                  <span className="font-bold text-navy-900 dark:text-slate-100">{job.title || 'Technical Role'}</span>
                  <span className="text-slate-300 dark:text-slate-700">•</span>
                  <span className="text-slate-600 dark:text-slate-300 font-medium">{job.experience || '5-8 Years Exp'}</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-teal-700 dark:text-teal-400 font-semibold">
                  <Sparkles className="w-4 h-4" />
                  <span>Derived from JD technical stack</span>
                </div>
              </div>

              {/* Technical Screening Questions */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs sm:text-sm font-bold uppercase tracking-wider text-navy-950 dark:text-slate-100 flex items-center gap-1.5">
                    <span>Technical Screening Questions &amp; Evaluation Signals</span>
                  </span>
                  <span className="text-xs text-slate-400 hidden sm:inline">Ask during recruiter/hiring manager phone screens</span>
                </div>

                <div className="space-y-3">
                  {screeningKit.questions.map((q, idx) => (
                    <div
                      key={q.id || idx}
                      className="p-4 rounded-xl bg-white dark:bg-surface-darkBg border border-slate-200/80 dark:border-surface-darkBorder space-y-2.5 shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-lg bg-teal-100 dark:bg-teal-950/80 text-teal-800 dark:text-teal-300 font-bold text-xs flex items-center justify-center flex-shrink-0">
                            {idx + 1}
                          </span>
                          <span className="text-sm font-bold text-navy-900 dark:text-slate-100">
                            {q.category}
                          </span>
                        </div>
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-lg text-xs font-semibold bg-brand-50 dark:bg-brand-950/60 text-brand-700 dark:text-brand-300 border border-brand-200 dark:border-brand-800">
                          {q.skillTag}
                        </span>
                      </div>

                      <p className="text-sm text-navy-950 dark:text-slate-100 font-semibold leading-relaxed pl-8">
                        "{q.question}"
                      </p>

                      <div className="pl-8 pt-1 text-xs sm:text-sm text-slate-600 dark:text-slate-300 flex items-start gap-2">
                        <CheckCircle2 className="w-4 h-4 text-teal-600 dark:text-teal-400 mt-0.5 flex-shrink-0" />
                        <span className="leading-relaxed">
                          <strong className="text-slate-800 dark:text-slate-200">Expected Signals:</strong> {q.expectedAnswer}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Candidate Evaluation Scorecard: Green Flags vs Red Flags */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                {/* Green Flags */}
                <div className="p-4 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-900/60 space-y-2.5">
                  <div className="flex items-center gap-2 text-xs sm:text-sm font-bold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider">
                    <span>🟢 Green Flags (Strong Positive Signals)</span>
                  </div>
                  <ul className="space-y-2 text-xs sm:text-sm text-slate-700 dark:text-slate-200">
                    {screeningKit.greenFlags.map((flag, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 mt-0.5 flex-shrink-0" />
                        <span className="leading-relaxed">{flag}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Red Flags */}
                <div className="p-4 rounded-xl bg-rose-50/50 dark:bg-rose-950/30 border border-rose-200/80 dark:border-rose-900/60 space-y-2.5">
                  <div className="flex items-center gap-2 text-xs sm:text-sm font-bold text-rose-800 dark:text-rose-300 uppercase tracking-wider">
                    <span>🔴 Red Flags (Watch-outs &amp; Risks)</span>
                  </div>
                  <ul className="space-y-2 text-xs sm:text-sm text-slate-700 dark:text-slate-200">
                    {screeningKit.redFlags.map((flag, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <X className="w-4 h-4 text-rose-500 dark:text-rose-400 mt-0.5 flex-shrink-0" />
                        <span className="leading-relaxed">{flag}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
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
                  Job Description Related Companies &amp; Sourcing Ecosystem
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
              {/* Target Hiring Client Callout & Non-Poach Sourcing Advisory */}
              <div className="flex items-center justify-between flex-wrap gap-2.5 p-3 rounded-xl bg-slate-50 dark:bg-surface-darkBg border border-slate-200/80 dark:border-surface-darkBorder">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs sm:text-sm font-semibold text-slate-500 dark:text-slate-400">
                    {job.client || job.client_name ? 'Target Hiring Client:' : 'Talent Sourcing Strategy:'}
                  </span>
                  {(job.client || job.client_name) ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs sm:text-sm font-bold bg-brand-50 dark:bg-brand-950/60 text-brand-700 dark:text-brand-300 border border-brand-200 dark:border-brand-800">
                      <Building2 className="w-3.5 h-3.5" />
                      {job.client || job.client_name}
                    </span>
                  ) : (
                    <span className="text-xs sm:text-sm font-semibold text-navy-900 dark:text-slate-100">
                      Tier-1 Competitors &amp; Parallel Ecosystems
                    </span>
                  )}
                  <span className="text-xs text-slate-400 dark:text-slate-500 hidden sm:inline">•</span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    Categorized by Product OEMs, Big 4 Advisory, GSIs &amp; Tech GCCs
                  </span>
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                  <Ban className="w-3.5 h-3.5 text-rose-500" />
                  <span>Mark companies as <b>⛔ Off-Limits</b> to prevent non-poach breaches</span>
                </div>
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
                      ]}
                      icon={SlidersHorizontal}
                      size="sm"
                      placeholder="Sourcing Actions ▾"
                      ariaLabel="Sourcing bulk actions"
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

              {/* Rich Company Cards Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3.5 pt-1">
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
                      className={`relative flex flex-col justify-between p-3.5 rounded-2xl border overflow-hidden transition-all duration-150 ${
                        isTargeted
                          ? 'border-indigo-500 dark:border-indigo-400 bg-indigo-50/30 dark:bg-indigo-950/20 shadow-sm ring-1 ring-indigo-500/20'
                          : isExcluded
                          ? 'border-rose-400 dark:border-rose-600 bg-rose-50/30 dark:bg-rose-950/20 shadow-sm ring-1 ring-rose-500/20'
                          : 'border-slate-200/90 dark:border-surface-darkBorder bg-white dark:bg-surface-darkBg hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-subtle'
                      }`}
                    >
                      {/* Card Top: Category Badge & External LinkedIn Search */}
                      <div>
                        <div className="flex items-center justify-between gap-1 mb-2">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold border uppercase tracking-wider ${
                              catMeta.color ||
                              'text-slate-600 bg-slate-50 border-slate-200'
                            }`}
                          >
                            <CatIcon className="w-3 h-3" />
                            <span>{catMeta.label.split(' ')[0]}</span>
                          </span>

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
                          <h5 className="text-sm font-bold text-navy-950 dark:text-slate-100 leading-snug">
                            {company.name}
                          </h5>
                          {company.tier && (
                            <span className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400">
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
                      </div>

                      {/* Card Bottom: Segmented Target vs Off-Limits Control */}
                      <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-surface-darkBorder/60">
                        <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-slate-800/80">
                          {/* Target Button */}
                          <button
                            type="button"
                            onClick={() => handleToggleCompany(company.name)}
                            className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs font-bold transition-all duration-150 truncate ${
                              isTargeted
                                ? 'bg-indigo-600 text-white shadow-sm'
                                : 'text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-white dark:hover:bg-slate-700/60'
                            }`}
                            title={isTargeted ? 'Targeted in Boolean pool' : 'Click to add to target sourcing pool'}
                          >
                            <Target className="w-3.5 h-3.5 flex-shrink-0" />
                            <span className="truncate">{isTargeted ? 'Targeted' : 'Target'}</span>
                          </button>

                          {/* Off-Limits / Non-Poach Exclude Button */}
                          <button
                            type="button"
                            onClick={() => handleToggleExcludeCompany(company.name)}
                            className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs font-bold transition-all duration-150 truncate ${
                              isExcluded
                                ? 'bg-rose-600 text-white shadow-sm'
                                : 'text-slate-600 dark:text-slate-300 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-white dark:hover:bg-slate-700/60'
                            }`}
                            title={isExcluded ? 'Marked as off-limits / non-poach protected' : 'Click to mark as off-limits (NOT clause)'}
                          >
                            <Ban className="w-3.5 h-3.5 flex-shrink-0" />
                            <span className="truncate">{isExcluded ? 'Off-Limits' : 'Exclude'}</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

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
                  Boolean Search Query Generator
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
                  AI Auto-Generated
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
                suggestedKeywords.map((kw) => (
                  <button
                    key={kw}
                    type="button"
                    onClick={() => handleAddKeywordToQuery(kw)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200/90 dark:border-emerald-800 hover:bg-emerald-100 hover:border-emerald-300 dark:hover:bg-emerald-900/50 transition-all shadow-2xs active:scale-95"
                    title={`Click to add "${kw}" to Boolean query`}
                  >
                    <Plus className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>{kw}</span>
                  </button>
                ))
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
                  Recruiter Semantic Matching Results
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
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                Ranked using active approved JD embeddings and candidate resume vectors.
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
                      {matchingCandidates.filter((c) => (c.matchScore || c.match_score || 0) >= 75).length}
                    </span>
                    <span className="text-xs text-emerald-600 dark:text-emerald-400/80 block mt-0.5">score &ge; 75%</span>
                  </div>
                  <div className="p-3.5 bg-brand-50/60 dark:bg-surface-darkBg border border-brand-200/60 dark:border-brand-900/60 rounded-xl">
                    <span className="text-xs uppercase font-bold text-brand-700 dark:text-brand-400 block tracking-wider mb-1">Average Fit</span>
                    <span className="text-xl font-extrabold text-brand-900 dark:text-brand-300">
                      {Math.round(
                        matchingCandidates.reduce((acc, c) => acc + (c.matchScore || c.match_score || 0), 0) /
                          matchingCandidates.length
                      )}%
                    </span>
                    <span className="text-xs text-brand-600 dark:text-brand-400/80 block mt-0.5">across pool</span>
                  </div>
                  <div className="p-3.5 bg-blue-50/60 dark:bg-surface-darkBg border border-blue-200/60 dark:border-blue-900/60 rounded-xl">
                    <span className="text-xs uppercase font-bold text-blue-700 dark:text-blue-400 block tracking-wider mb-1">Top Score</span>
                    <span className="text-xl font-extrabold text-blue-900 dark:text-blue-300">
                      {Math.max(...matchingCandidates.map((c) => c.matchScore || c.match_score || 0))}%
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
                candidates={filteredMatchingCandidates}
                onSelectCandidate={onSelectCandidate}
                onOpenWorkspace={() => onOpenMatrix?.(job)}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
};
