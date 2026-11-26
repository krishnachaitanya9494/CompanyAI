"""Intelligent Target Company Recommendation Engine for CompanyAI Recruitment Sourcing.

Provides JD-aware, explainable target company recommendations, sourcing strategy
selection, and headhunting pool intelligence across IT, Creative, Finance, Retail Operations,
and Enterprise GCC ecosystems.
"""

from __future__ import annotations

import re
from typing import Any, Dict, List, Optional, Set, Tuple
from sqlalchemy.orm import Session

from database.models import Job, JobDescription
from app.services.skill_taxonomy_service import detect_jd_domain, extract_skills_from_jd
from app.ai.providers.chat_provider import chat_provider


# Verified corporate sourcing catalogs organized by industry & technology ecosystems
COMPANY_ECOSYSTEMS_CATALOG: List[Dict[str, Any]] = [
    # 1. Finance, Corporate Accounting, Audit & Tax Sourcing Ecosystem
    {
        "id": "finance_accounting",
        "name": "Finance, Corporate Accounting, Audit & Tax Sourcing Ecosystem",
        "domains": ["finance_accounting", "finance", "accounting", "tax", "audit"],
        "keywords": [
            "accountant", "accounting", "finance", "general ledger", "gst", "tds", "tax",
            "audit", "reconciliation", "sut", "balance sheet", "p&l", "accounts payable",
            "accounts receivable", "statutory", "financial reporting", "r2r", "record to report",
            "controllership", "taxation", "challan", "26as", "us gaap", "ifrs"
        ],
        "primary_strategy": "Direct Industry Experience",
        "strategy_rationale": "Statutory compliance, direct/indirect taxation (GST/TDS), general ledger reconciliations, and US SUT operations are heavily concentrated in Big 4 advisory practices, institutional financial GCCs, and enterprise Record-to-Report (R2R) hubs.",
        "companies": [
            # Tier 1: Big 4 Advisory & Tax Practices, Top Financial GCCs
            {
                "name": "Deloitte India (Tax & Assurance)",
                "category": "big4",
                "tier_level": "Tier 1",
                "tier": "Tier-1 Big 4 Advisory Leader",
                "location": "Mumbai / Bangalore / Hyderabad",
                "description": "Enterprise tax advisory, statutory audit, and GST compliance practice.",
                "domain_specialties": ["Tax Compliance", "GST", "TDS", "Statutory Audit", "Tax Audits"],
                "why_recommended": "Tier-1 Big 4 practice with proven exposure to complex GST returns, corporate tax assessments, and statutory audit readiness.",
            },
            {
                "name": "PwC India (Tax & Regulatory)",
                "category": "big4",
                "tier_level": "Tier 1",
                "tier": "Tier-1 Global Advisory & Tax",
                "location": "Bangalore / Hyderabad / Kolkata",
                "description": "Direct and indirect taxation, corporate compliance, and regulatory audit representation.",
                "domain_specialties": ["Direct & Indirect Tax", "TDS", "GST Filing", "Form 26AS/AIS", "Tax Assessments"],
                "why_recommended": "Premier corporate taxation practice; deep bench of qualified accountants skilled in Form 26AS/AIS reconciliations and tax challans.",
            },
            {
                "name": "EY India (GDS / Assurance & Tax)",
                "category": "big4",
                "tier_level": "Tier 1",
                "tier": "Tier-1 Advisory Practice Leader",
                "location": "Bangalore / Gurgaon / Mumbai",
                "description": "Global financial accounting advisory services (FAAS), statutory reporting, and ledger governance.",
                "domain_specialties": ["General Ledger", "Balance Sheet", "Reconciliation", "Statutory Reporting", "US GAAP"],
                "why_recommended": "Leading financial assurance division providing hands-on accountants adept at complex multi-entity ledger reconciliations.",
            },
            {
                "name": "KPMG India",
                "category": "big4",
                "tier_level": "Tier 1",
                "tier": "Tier-1 Audit & Tax Advisory Firm",
                "location": "Bangalore / Mumbai / Pune",
                "description": "Corporate tax compliance, transfer pricing, and statutory accounting services.",
                "domain_specialties": ["Tax Compliance", "GST Working Papers", "TDS Returns", "Audit Schedules"],
                "why_recommended": "High-rigor statutory audit and corporate compliance division managing high-volume tax filings and auditor documentation.",
            },
            {
                "name": "JPMorgan Chase GCC (Finance Operations)",
                "category": "gcc",
                "tier_level": "Tier 1",
                "tier": "Tier-1 Top Financial GCC",
                "location": "Bangalore / Hyderabad / Mumbai",
                "description": "Global banking controllership, enterprise ledger reconciliations, and financial close operations.",
                "domain_specialties": ["General Ledger", "US SUT & Sales Tax", "Account Reconciliation", "Financial Close"],
                "why_recommended": "Institutional finance operations hub managing high-volume daily ledger reconciliations, US sales tax, and strict regulatory controls.",
            },
            {
                "name": "Goldman Sachs (Finance & Controllers)",
                "category": "gcc",
                "tier_level": "Tier 1",
                "tier": "Tier-1 Global Investment Bank GCC",
                "location": "Bangalore / Hyderabad",
                "description": "Global controllership, regulatory reporting, and balance sheet substantiation.",
                "domain_specialties": ["Balance Sheet Substantiation", "Ledger Reconciliations", "SAP Financials", "Regulatory Reporting"],
                "why_recommended": "Elite institutional financial center with deep talent bench in balance sheet analysis and cross-border financial reconciliation.",
            },
            {
                "name": "Morgan Stanley GIC",
                "category": "gcc",
                "tier_level": "Tier 1",
                "tier": "Tier-1 Global Financial GCC",
                "location": "Mumbai / Bangalore",
                "description": "Institutional finance, tax accounting, and global financial operations.",
                "domain_specialties": ["General Ledger Accounting", "Reconciliations", "Tax Accounting", "Financial Controls"],
                "why_recommended": "Premier global investment banking hub with rigorous internal financial controls and tax compliance operations.",
            },

            # Tier 2: Record-to-Report & Enterprise Finance Operations
            {
                "name": "Genpact (Record-to-Report)",
                "category": "gsi",
                "tier_level": "Tier 2",
                "tier": "Tier-2 Enterprise BPO & R2R Leader",
                "location": "Gurgaon / Hyderabad / Bangalore",
                "description": "Global Record-to-Report (R2R) accounting processes, SAP ERP data extraction, and general ledger operations.",
                "domain_specialties": ["SAP Data Extraction", "General Ledger (R2R)", "Monthly Financial Close", "Account Reconciliation"],
                "why_recommended": "Industry pioneer in Record-to-Report (R2R); massive talent pool specializing in SAP ERP ledger extracts and multi-entity reconciliations.",
            },
            {
                "name": "Accenture Operations (Finance & Accounting)",
                "category": "gsi",
                "tier_level": "Tier 2",
                "tier": "Tier-2 Global Integrator Leader",
                "location": "Bangalore / Hyderabad / Pune",
                "description": "Enterprise finance and accounting shared services managing multi-country general ledger and tax compliance.",
                "domain_specialties": ["SAP ERP Financials", "General Ledger", "Tax Operations", "Process Documentation"],
                "why_recommended": "Leading global finance BPS practice managing end-to-end accounting processes, SOP documentation, and vendor query resolution.",
            },
            {
                "name": "WNS Global Services",
                "category": "gsi",
                "tier_level": "Tier 2",
                "tier": "Tier-2 Enterprise BPO Leader",
                "location": "Mumbai / Pune / Bangalore",
                "description": "Enterprise financial accounting, accounts payable/receivable, and compliance reporting.",
                "domain_specialties": ["General Ledger", "Vendor Coordination", "Compliance Trackers", "Process Documentation"],
                "why_recommended": "Specialized financial operations provider with scalable talent handling vendor queries, compliance calendars, and audit trails.",
            },
            {
                "name": "EXL Service",
                "category": "gsi",
                "tier_level": "Tier 2",
                "tier": "Tier-2 Enterprise Operations Specialist",
                "location": "Noida / Gurgaon / Bangalore",
                "description": "Finance transformation, accounting reconciliations, and data-driven controllership.",
                "domain_specialties": ["Account Reconciliations", "Process Workflows", "Audit Documentation", "SAP Extraction"],
                "why_recommended": "High-efficiency finance operations practice delivering automated reconciliations and audit-ready accounting workpapers.",
            },
            {
                "name": "Infosys BPM (Finance & Accounting)",
                "category": "gsi",
                "tier_level": "Tier 2",
                "tier": "Tier-2 Global Tier 1 GSI",
                "location": "Bangalore / Pune / Chennai",
                "description": "Enterprise financial shared services, statutory compliance support, and ERP general ledger accounting.",
                "domain_specialties": ["SAP General Ledger", "Statutory Compliance", "Reconciliation Schedules", "Tax Returns"],
                "why_recommended": "Scalable enterprise accounting practice with certified finance professionals experienced in SAP data extraction and tax schedules.",
            },
            {
                "name": "TCS Enterprise Financial Services",
                "category": "gsi",
                "tier_level": "Tier 2",
                "tier": "Tier-2 Global Tier 1 GSI",
                "location": "Mumbai / Bangalore / Chennai",
                "description": "Global accounting shared services, SAP financial operations, and statutory filing support.",
                "domain_specialties": ["SAP ERP", "General Ledger Accounting", "Tax Documentation", "Balance Sheet Reconciliation"],
                "why_recommended": "Deep bench of corporate accountants managing large enterprise ERP financial data and regulatory filing schedules.",
            },

            # Tier 3: Specialized Mid-Tier & Regional Tax Consultancies
            {
                "name": "BDO India",
                "category": "big4",
                "tier_level": "Tier 3",
                "tier": "Tier-3 Specialized Tax & Accounting Practice",
                "location": "Mumbai / Bangalore / Gurgaon",
                "description": "Mid-tier accounting advisory specializing in GST audits, corporate tax returns, and client compliance.",
                "domain_specialties": ["GST Returns", "TDS Compliance", "Tax Audit Documentation", "Form 26AS/AIS"],
                "why_recommended": "Mid-market accounting firm offering nimble tax professionals skilled in direct client handling, GST workings, and tax notices.",
            },
            {
                "name": "Grant Thornton Bharat",
                "category": "big4",
                "tier_level": "Tier 3",
                "tier": "Tier-3 Mid-Tier Advisory Practice",
                "location": "Gurgaon / Mumbai / Bangalore",
                "description": "Assurance, tax compliance, and financial reporting advisory for mid-to-large corporates.",
                "domain_specialties": ["Statutory Compliance", "Tax Audits", "General Ledger Reviews", "Working Papers"],
                "why_recommended": "Established professional services firm with strong talent in preparing tax audit workpapers and Form 26AS reconciliations.",
            },
            {
                "name": "Singhi & Co",
                "category": "big4",
                "tier_level": "Tier 3",
                "tier": "Tier-3 Regional CA Firm",
                "location": "Kolkata / Mumbai / Bangalore",
                "description": "Renowned Indian CA firm specializing in statutory audit, internal controls, and taxation.",
                "domain_specialties": ["Statutory Audit", "Taxation", "Reconciliations", "Notice Responses"],
                "why_recommended": "Traditional Indian CA powerhouse providing hands-on accountants with deep grassroots experience in tax notices and statutory audits.",
            },
            {
                "name": "Haribhakti & Co",
                "category": "big4",
                "tier_level": "Tier 3",
                "tier": "Tier-3 Regional Accounting & Tax Practice",
                "location": "Mumbai / Bangalore / Ahmedabad",
                "description": "Domestic accounting, tax advisory, and risk management firm.",
                "domain_specialties": ["Direct Tax", "GST Compliance", "Ledger Verification", "Challan Filings"],
                "why_recommended": "Respected domestic accounting firm training professionals in meticulous tax challan filings and ledger verification.",
            },
            {
                "name": "Baker Tilly India",
                "category": "big4",
                "tier_level": "Tier 3",
                "tier": "Tier-3 Global Network Accounting Practice",
                "location": "Mumbai / Pune / Bangalore",
                "description": "Accounting compliance, reporting, and US tax operations support.",
                "domain_specialties": ["US Sales & Use Tax (SUT)", "General Ledger", "Reconciliations", "Compliance Tracking"],
                "why_recommended": "Specialized advisory practice handling US and domestic accounting compliance, SUT filings, and exemption records.",
            },
        ],
    },

    # 2. Creative, Advertising, Media & Design (Art Director, Creative Director, Graphic Design)
    {
        "id": "creative_advertising",
        "name": "Advertising Agencies, Media Networks & Creative Studios",
        "domains": ["creative_design", "marketing", "media", "advertising"],
        "keywords": ["art director", "creative director", "graphic design", "advertising", "photoshop", "illustrator", "indesign", "storyboarding", "visual design", "packaging", "multichannel"],
        "primary_strategy": "Direct Industry Experience",
        "strategy_rationale": "Creative excellence, visual direction, and client brand stewardship are most consistently found in advertising agencies, production studios, and digital agency networks.",
        "companies": [
            {"name": "Ogilvy (WPP)", "category": "agency", "tier_level": "Tier 1", "tier": "Tier-1 Global Agency Network", "location": "Mumbai / Bangalore / Gurgaon", "description": "Global advertising and creative transformation network with extensive art direction and campaign teams.", "domain_specialties": ["Art Direction", "Creative Direction", "Multichannel Creative", "Brand Identity"], "why_recommended": "Premier global creative agency network; primary source for award-winning Art Directors and brand campaign visual leads."},
            {"name": "McCann Worldgroup", "category": "agency", "tier_level": "Tier 1", "tier": "Tier-1 Global Creative Network", "location": "Mumbai / Bangalore / Delhi", "description": "High-impact advertising, branding, and packaging art direction specialists.", "domain_specialties": ["Packaging Design", "Advertising Campaigns", "Visual Design", "Creative Strategy"], "why_recommended": "Top creative network known for packaging innovation, visual storytelling, and high-impact retail consumer campaigns."},
            {"name": "DDB Mudra Group", "category": "agency", "tier_level": "Tier 1", "tier": "Tier-1 Creative & Brand Agency", "location": "Mumbai / Bangalore / Gurgaon", "description": "Omnichannel creative strategy, visual design, and brand communication agency.", "domain_specialties": ["Omnichannel Design", "Typography", "Art Direction", "Brand Communications"], "why_recommended": "Leading integrated agency producing high-concept visual campaigns and multi-platform advertising art direction."},
            {"name": "Lowe Lintas (MullenLowe)", "category": "agency", "tier_level": "Tier 1", "tier": "Tier-1 Top Brand Agency", "location": "Mumbai / Bangalore / Chennai", "description": "Brand narrative, advertising production, and creative campaign execution.", "domain_specialties": ["Brand Narrative", "Storyboarding", "Creative Production", "Advertising Design"], "why_recommended": "Authoritative brand storytelling agency with experienced art leads skilled in TVC storyboarding and visual campaigns."},
            {"name": "Leo Burnett (Publicis)", "category": "agency", "tier_level": "Tier 1", "tier": "Tier-1 Top Creative Network", "location": "Mumbai / Bangalore / Gurgaon", "description": "Creative transformation, multimedia advertising, and visual brand direction.", "domain_specialties": ["Creative Transformation", "Multimedia Advertising", "Visual Storytelling", "Adobe Creative Suite"], "why_recommended": "World-class creative powerhouse developing iconic visual concepts, typography standards, and brand identity systems."},
            {"name": "Dentsu Creative", "category": "agency", "tier_level": "Tier 1", "tier": "Tier-1 Global Media & Creative", "location": "Bangalore / Mumbai / Gurgaon", "description": "Integrated creative, digital experience, and multimedia production agency.", "domain_specialties": ["Digital Experience", "Creative Direction", "Motion Graphics", "Advertising Art"], "why_recommended": "Digital-first global creative agency delivering integrated visual design and innovative experiential campaigns."},
            {"name": "Flipkart Creative Studios", "category": "gcc", "tier_level": "Tier 1", "tier": "Tier-1 E-Commerce Creative Studio", "location": "Bangalore", "description": "In-house creative direction, digital catalog visuals, and campaign art production.", "domain_specialties": ["E-Commerce Visuals", "In-House Creative Direction", "Digital Catalog Design", "Campaign Assets"], "why_recommended": "High-volume in-house creative division producing commercial retail art, digital branding, and seasonal festive campaigns."},
            {"name": "Amazon Creative Services", "category": "gcc", "tier_level": "Tier 1", "tier": "Tier-1 In-House Digital Media", "location": "Bangalore / Chennai", "description": "Global in-house digital advertising, packaging guidelines, and visual storytelling.", "domain_specialties": ["Digital Advertising", "Packaging Guidelines", "Visual Guidelines", "Art Direction"], "why_recommended": "Global in-house studio enforcing brand guidelines, digital merchandising art, and international ad campaigns."},
            {"name": "Schbang", "category": "agency", "tier_level": "Tier 2", "tier": "Tier-2 Digital Creative Studio", "location": "Mumbai / Bangalore / Delhi", "description": "Digital-first creative production, branding, visual design, and motion graphics.", "domain_specialties": ["Digital Branding", "Motion Graphics", "Social Creative", "Visual Design"], "why_recommended": "Agile digital creative agency with high-output visual designers skilled in contemporary social and web art direction."},
            {"name": "Famous Innovations", "category": "agency", "tier_level": "Tier 2", "tier": "Tier-2 Independent Creative Studio", "location": "Mumbai / Bangalore", "description": "Award-winning independent creative, packaging, and brand design studio.", "domain_specialties": ["Packaging Art Direction", "Brand Identity", "Print & Digital Media", "Concept Design"], "why_recommended": "Award-winning independent studio celebrated for distinctive packaging aesthetics and craft-driven art direction."},
            {"name": "FCB Ulka", "category": "agency", "tier_level": "Tier 2", "tier": "Tier-2 Integrated Advertising Agency", "location": "Mumbai / Bangalore / Gurgaon", "description": "Integrated brand solutions, print and film production, and promotional design.", "domain_specialties": ["Print Production", "Promotional Design", "Art Direction", "Storyboarding"], "why_recommended": "Established full-service advertising agency delivering robust commercial campaign visuals and layout designs."},
            {"name": "Studio Mosaic", "category": "agency", "tier_level": "Tier 3", "tier": "Tier-3 Boutique Design Studio", "location": "Delhi / Bangalore", "description": "App branding, digital creative assets, and performance marketing graphics.", "domain_specialties": ["App Branding", "Digital Asset Design", "Typography", "Fast-turnaround Graphics"], "why_recommended": "Specialized boutique design studio producing fast-turnaround digital marketing creative and mobile visuals."},
            {"name": "Animal Creative Studio", "category": "agency", "tier_level": "Tier 3", "tier": "Tier-3 Independent Art & Design Co.", "location": "Delhi / Remote", "description": "Experimental design, typography, and avant-garde brand identities.", "domain_specialties": ["Avant-garde Visuals", "Custom Typography", "Brand Experiments", "Editorial Design"], "why_recommended": "Boutique creative shop pushing visual boundaries in bespoke typography, editorial layouts, and brand identity."},
        ],
    },

    # 3. Retail Operations, Item Setup, PIM & E-Commerce Operations
    {
        "id": "retail_operations_ecommerce",
        "name": "Retail Operations, Merchandising & E-Commerce Hubs",
        "domains": ["retail_operations", "retail_product_operations", "ecommerce", "supply_chain", "operations"],
        "keywords": ["item setup", "product data", "merchandising", "data quality", "vendor coordination", "sku setup", "retail operations", "launch readiness", "master data", "pim"],
        "primary_strategy": "Direct Industry Experience",
        "strategy_rationale": "High-volume SKU setup, merchant coordination, and data remediation are core competencies developed in top retail GCCs and e-commerce platforms.",
        "companies": [
            {"name": "Amazon India Operations", "category": "retail", "tier_level": "Tier 1", "tier": "Tier-1 E-Commerce Operator", "location": "Bangalore / Hyderabad / Chennai", "description": "Global catalog operations, new item setup, vendor central coordination, and catalog quality.", "domain_specialties": ["Item Setup", "Catalog Quality", "Vendor Coordination", "Data Remediation"], "why_recommended": "Global catalog operations leader with deep teams executing vendor onboarding, item ingestion, and data governance."},
            {"name": "Walmart Global Tech & Operations", "category": "retail", "tier_level": "Tier 1", "tier": "Tier-1 Retail Enterprise Hub", "location": "Bangalore / Chennai", "description": "Large-scale item setup, merchandising systems, master data quality, and vendor portals.", "domain_specialties": ["Master Data Management", "New Item Launch", "Vendor Portals", "Product Data"], "why_recommended": "Largest retail operations center handling high-volume SKU creation, supplier compliance, and catalog readiness."},
            {"name": "Target India", "category": "retail", "tier_level": "Tier 1", "tier": "Tier-1 Global Retail GCC", "location": "Bangalore", "description": "Dedicated retail merchandising operations, item launch readiness, and supplier compliance.", "domain_specialties": ["Item Launch Readiness", "Merchandising Operations", "Supplier Compliance", "Data Quality"], "why_recommended": "Dedicated retail merchandising operations CoE specializing in item setup workflows and launch governance."},
            {"name": "Flipkart Operations", "category": "retail", "tier_level": "Tier 1", "tier": "Tier-1 Leading Indian E-Commerce", "location": "Bangalore", "description": "End-to-end cataloging, item onboarding, category operations, and data remediation.", "domain_specialties": ["Catalog Ingestion", "Category Operations", "SKU Setup", "Process Improvement"], "why_recommended": "Leading domestic e-commerce platform managing rapid merchant catalog onboarding and data quality auditing."},
            {"name": "Myntra", "category": "retail", "tier_level": "Tier 2", "tier": "Tier-2 Fashion E-Commerce Hub", "location": "Bangalore", "description": "Apparel and lifestyle item setup, digital catalog validation, and vendor coordination.", "domain_specialties": ["Catalog Validation", "Attribute Management", "Vendor SLAs", "Merchandising"], "why_recommended": "Fast-paced fashion e-commerce operations hub with rigorous item attribute validation and merchant support."},
            {"name": "Reliance Retail", "category": "retail", "tier_level": "Tier 2", "tier": "Tier-2 Omnichannel Retail Leader", "location": "Mumbai / Bangalore", "description": "Large-scale retail item onboarding, inventory master data, and merchant workflow operations.", "domain_specialties": ["Inventory Master Data", "Merchant Workflows", "Item Onboarding", "Store Planning"], "why_recommended": "Expansive omnichannel retail operator managing multi-category master data, supplier catalogs, and SKU lifecycles."},
            {"name": "Genpact Retail Operations", "category": "gsi", "tier_level": "Tier 2", "tier": "Tier-2 BPS Operations Leader", "location": "Gurgaon / Hyderabad / Bangalore", "description": "Enterprise retail data management, master data governance, and merchant support services.", "domain_specialties": ["Master Data Governance", "Data Cleansing", "Merchant Support", "Process Documentation"], "why_recommended": "Enterprise BPS division managing managed services for retail product data, item cleansing, and vendor queries."},
            {"name": "Wipro Retail BPS", "category": "gsi", "tier_level": "Tier 2", "tier": "Tier-2 Retail BPO Practice", "location": "Bangalore / Chennai", "description": "Managed item setup, e-commerce catalog operations, and vendor SLA management.", "domain_specialties": ["Managed Item Setup", "Catalog SLA Management", "Data Remediation", "Quality Audits"], "why_recommended": "Established retail BPO practice delivering outsourced item creation and catalog maintenance for global retailers."},
            {"name": "TCS Retail & CPG", "category": "gsi", "tier_level": "Tier 2", "tier": "Tier-2 Global Retail Services", "location": "Mumbai / Bangalore / Chennai", "description": "Global retail merchandising workflows, data remediation, and item launch tracking.", "domain_specialties": ["Merchandising Workflows", "Launch Tracking", "Data Validation", "ERP Master Data"], "why_recommended": "Comprehensive retail enterprise practice with deep experience in retail ERP data and catalog launch management."},
            {"name": "Ace Turtle", "category": "retail", "tier_level": "Tier 3", "tier": "Tier-3 Omnichannel Retail Tech", "location": "Bangalore", "description": "Retail tech platform managing item feeds and catalog synchronization for global brands.", "domain_specialties": ["Item Feed Sync", "E-Commerce Catalog", "Marketplace Operations", "Data Accuracy"], "why_recommended": "Omnichannel enablement partner providing agile operators experienced in multi-channel catalog synchronization."},
            {"name": "BigBasket Operations", "category": "retail", "tier_level": "Tier 3", "tier": "Tier-3 Quick Commerce & Grocery", "location": "Bangalore", "description": "High-velocity FMCG cataloging, SKU attribute updates, and vendor master data.", "domain_specialties": ["FMCG Cataloging", "Attribute Updates", "Vendor Compliance", "Fast Item Launches"], "why_recommended": "High-velocity retail operations center handling rapid FMCG item creation and supplier compliance."},
        ],
    },

    # 4. CAD, BIM, Digital Engineering & Architectural Systems
    {
        "id": "cad_bim_engineering",
        "name": "CAD, BIM, Digital Engineering & Architectural Systems",
        "domains": ["cad_engineering", "engineering_design", "civil_engineering", "digital_engineering", "architecture"],
        "keywords": ["cad", "autocad", "microstation", "revit", "bim", "bim 360", "bluebeam", "drafting", "building engineered systems", "architectural", "store planning", "remodel", "digital engineering"],
        "primary_strategy": "Direct Industry Experience",
        "strategy_rationale": "Specialized proficiency in AutoCAD, MicroStation, Revit BIM, and commercial building remodel documentation is concentrated in engineering software OEMs (Tier 1), premier engineering consultancies & GSIs (Tier 2), and specialized boutique drafting & Scan-to-BIM studios (Tier 3).",
        "companies": [
            {"name": "Autodesk India", "category": "oem", "tier_level": "Tier 1", "tier": "Tier-1 Design & CAD Software OEM", "location": "Bangalore", "description": "Platform creator of AutoCAD, Revit, and BIM 360 cloud collaboration.", "domain_specialties": ["AutoCAD", "Autodesk Revit", "BIM 360", "Navisworks"], "why_recommended": "Platform creators with authoritative architectural modeling proficiency; primary source for lead CAD/BIM standards drafters."},
            {"name": "Bentley Systems", "category": "oem", "tier_level": "Tier 1", "tier": "Tier-1 Infrastructure Engineering OEM", "location": "Pune / Kolkata / Chennai", "description": "Core engineering and development center for MicroStation and ProjectWise.", "domain_specialties": ["MicroStation", "ProjectWise", "OpenBuildings", "Plant CAD"], "why_recommended": "Direct creator of MicroStation; deepest talent pool for infrastructure drafting and precision digital building models."},
            {"name": "Trimble India", "category": "oem", "tier_level": "Tier 1", "tier": "Tier-1 BIM & Geospatial Tech OEM", "location": "Chennai / Pune", "description": "Building construction modeling, Tekla Structures, and BIM software engineering.", "domain_specialties": ["Tekla Structures", "Trimble Connect", "BIM Modeling", "Revit Interoperability"], "why_recommended": "World-class building construction modeling and 3D detailing engineers with hands-on BIM implementation."},
            {"name": "Target India (Target GCC)", "category": "gcc", "tier_level": "Tier 1", "tier": "Tier-1 Retail Space & Remodel Hub", "location": "Bangalore", "description": "Direct in-house retail asset protection, store remodel documentation, and BIM facility planning.", "domain_specialties": ["Retail Store Remodel CAD", "Commercial Space Planning", "Revit BIM", "Floorplan Drafting"], "why_recommended": "Dedicated retail space planning and store remodel CAD drafting team with 100% direct domain workflow overlap."},
            {"name": "Lowe's India", "category": "gcc", "tier_level": "Tier 1", "tier": "Tier-1 Retail Facility & Store CAD Hub", "location": "Bangalore", "description": "Retail store design, commercial space planning, and remodel CAD drafting operations.", "domain_specialties": ["Retail Store Layout CAD", "Fixture Planning", "Revit Commercial BIM", "AutoCAD Drafting"], "why_recommended": "Large-scale retail space planning, store fixture layout, and architectural remodel drafting CoE."},
            {"name": "Walmart Global Tech", "category": "gcc", "tier_level": "Tier 1", "tier": "Tier-1 Retail Space Planning & Tech GCC", "location": "Bangalore / Chennai", "description": "Global retail facility planning, store layout CAD modeling, and digital building operations.", "domain_specialties": ["Global Retail Remodel CAD", "Commercial Store Layouts", "BIM Documentation", "Building Systems"], "why_recommended": "Enterprise retail architectural remodel planning team maintaining global high-volume store floorplans."},
            {"name": "L&T Technology Services (LTTS)", "category": "gsi", "tier_level": "Tier 2", "tier": "Tier-2 Premier Digital Engineering Provider", "location": "Bangalore / Vadodara / Chennai", "description": "Leading engineering design services with deep AutoCAD, Revit, and facility design practices.", "domain_specialties": ["AutoCAD Plant 3D", "Revit MEP", "Facility Engineering", "Architectural Drafting"], "why_recommended": "Established engineering services provider with a massive bench of multi-disciplinary building drafting specialists."},
            {"name": "Tata Elxsi", "category": "gsi", "tier_level": "Tier 2", "tier": "Tier-2 Engineering Design Specialist", "location": "Bangalore / Pune / Trivandrum", "description": "Architectural rendering, spatial design, and digital engineering documentation.", "domain_specialties": ["Architectural 3D Rendering", "Spatial Design", "AutoCAD Drafting", "Digital Engineering Documentation"], "why_recommended": "Design-led engineering consultancy delivering commercial space modeling and high-precision spatial layouts."},
            {"name": "Cyient", "category": "gsi", "tier_level": "Tier 2", "tier": "Tier-2 Geospatial & Engineering Design Leader", "location": "Hyderabad / Bangalore / Noida", "description": "Large-scale utility, facility documentation, CAD drafting, and spatial modeling CoE.", "domain_specialties": ["Utilities CAD", "MicroStation Drafting", "Large-scale Facility Documentation", "As-Built CAD"], "why_recommended": "High-volume technical drafting center with rigorous quality checks and multi-platform CAD drafting benches."},
            {"name": "Quest Global", "category": "gsi", "tier_level": "Tier 2", "tier": "Tier-2 Global Engineering Services", "location": "Bangalore / Trivandrum / Pune", "description": "Mechanical, electrical, and commercial building systems engineering design.", "domain_specialties": ["Commercial Building Systems", "Mechanical CAD", "AutoCAD 2D/3D", "Revit Documentation"], "why_recommended": "Comprehensive building engineered systems practice with strong electrical, mechanical, and architectural drafters."},
            {"name": "WSP India", "category": "big4", "tier_level": "Tier 2", "tier": "Tier-2 Global Engineering & Design Consultancy", "location": "Noida / Bangalore / Mumbai", "description": "Premier international building engineering, BIM modeling, and architectural drafting firm.", "domain_specialties": ["Revit BIM Modeling", "Commercial Building Systems", "Structural CAD", "Architectural Detailing"], "why_recommended": "Premier international engineering firm working on landmark commercial structures and multi-trade BIM models."},
            {"name": "Jacobs India", "category": "big4", "tier_level": "Tier 2", "tier": "Tier-2 Global Technical & Infrastructure Services", "location": "Mumbai / Hyderabad / Bangalore", "description": "Comprehensive commercial building engineered systems, Revit BIM, and project drafting.", "domain_specialties": ["Comprehensive Building Systems", "Revit BIM Coordination", "AutoCAD", "MicroStation"], "why_recommended": "Elite global architectural engineering advisory with deep expertise in commercial facilities and building systems."},
            {"name": "AtkinsRéalis", "category": "big4", "tier_level": "Tier 2", "tier": "Tier-2 Engineering, Design & Project Management", "location": "Bangalore / Gurgaon / Mumbai", "description": "High-end architectural modeling, MicroStation drafting, and BIM asset coordination.", "domain_specialties": ["MicroStation Drafting", "Revit Asset Coordination", "Architectural Space Planning", "BIM Compliance"], "why_recommended": "High-rigor architectural and structural design consultancy with deep MicroStation and Revit coordination specialists."},
            {"name": "Neilsoft", "category": "gsi", "tier_level": "Tier 2", "tier": "Tier-2 Digital Engineering & BIM Services", "location": "Pune / Bangalore / Ahmedabad", "description": "Multi-disciplinary engineering design, BIM modeling, and architectural drafting services.", "domain_specialties": ["Architectural CAD Drafting", "BIM 360", "Revit Modeling", "Clash Detection"], "why_recommended": "Focused digital engineering practice with specialized delivery teams in commercial architectural modeling and documentation."},
            {"name": "Pinnacle Infotech", "category": "oem", "tier_level": "Tier 2", "tier": "Tier-2 Global BIM Solutions Leader", "location": "Durgapur / Kolkata / Jaipur", "description": "Global building information modeling and pre-construction engineering services.", "domain_specialties": ["BIM Engineering", "Revit Detailing", "Pre-construction CAD", "MEP Modeling"], "why_recommended": "Dedicated global BIM drafting powerhouse delivering high-speed, detailed architectural and MEP models."},
            {"name": "Cadsys India", "category": "gsi", "tier_level": "Tier 3", "tier": "Tier-3 Utility CAD & Legacy Conversion Specialist", "location": "Hyderabad", "description": "Specialized drafting services for utility network mapping, 2D drafting, and CAD conversion.", "domain_specialties": ["2D AutoCAD Drafting", "Paper-to-CAD Conversion", "Utility Mapping", "Floorplan Redlines"], "why_recommended": "Boutique CAD drafting vendor providing cost-effective drafters skilled in rapid redline markups and legacy drawing updates."},
            {"name": "Techture", "category": "gsi", "tier_level": "Tier 3", "tier": "Tier-3 BIM Coordination & Scan-to-BIM Studio", "location": "Nagpur / Indore / Pune", "description": "Boutique BIM consulting firm specializing in point-cloud to BIM and clash detection.", "domain_specialties": ["Scan-to-BIM", "Point Cloud Modeling", "Revit As-Built Documentation", "Clash Resolution"], "why_recommended": "Specialized BIM boutique focused on existing building documentation, as-built surveys, and remodel drafting."},
            {"name": "Magnasoft", "category": "gsi", "tier_level": "Tier 3", "tier": "Tier-3 Geospatial & Spatial CAD Drafting", "location": "Bangalore / Hyderabad", "description": "Spatial data engineering, architectural floorplan digitization, and GIS mapping.", "domain_specialties": ["AutoCAD Drafting", "Spatial Floorplan Modeling", "GIS Mapping", "Building CAD Assets"], "why_recommended": "Regional drafting center with skilled drafters accustomed to high-volume commercial asset mapping."},
            {"name": "Epitome AEC", "category": "gsi", "tier_level": "Tier 3", "tier": "Tier-3 Architectural 3D Modeling & Detailing", "location": "Noida / Delhi", "description": "AEC drafting services specializing in commercial shop drawings and interior architectural CAD.", "domain_specialties": ["Commercial Interior CAD", "Architectural Detailing", "Revit Families", "AutoCAD Layouts"], "why_recommended": "Fast-turnaround AEC detailing studio providing agile AutoCAD and Revit drafters for architectural renovations."},
            {"name": "Desirazu Associates", "category": "gsi", "tier_level": "Tier 3", "tier": "Tier-3 Commercial Building & MEP CAD Design", "location": "Bangalore / Chennai", "description": "Building services consultancy providing commercial MEP, HVAC, and building drawing services.", "domain_specialties": ["Building Engineered Systems", "AutoCAD MEP", "Commercial Layout Drafting", "Detail Drawings"], "why_recommended": "Specialist building engineering studio with experienced drafters for commercial building services."},
        ],
    },

    # 5. Core Software Engineering, Backend, Frontend & Cloud Applications
    {
        "id": "software_engineering",
        "name": "Software Engineering, Cloud Applications & Systems Architecture",
        "domains": ["software_engineering", "backend_engineering", "frontend_engineering"],
        "keywords": ["software engineer", "developer", "java", "python", "react", "typescript", "c#", ".net", "backend", "frontend", "full stack", "microservices", "spring boot", "fastapi"],
        "primary_strategy": "Technology / Tool-Based Sourcing",
        "strategy_rationale": "High-scale engineering practices and modern architectural patterns are best sourced from product engineering OEMs, tier-1 global systems integrators, and high-growth technology GCCs.",
        "companies": [
            {"name": "Microsoft IDC", "category": "oem", "tier_level": "Tier 1", "tier": "Tier-1 Technology OEM", "location": "Hyderabad / Bangalore / Noida", "description": "Enterprise cloud services, developer platforms, and distributed systems architecture.", "domain_specialties": ["Cloud Systems", "Microservices", "Distributed Computing", "C# / .NET / Java"], "why_recommended": "Premier platform OEM with authoritative software engineering standards, distributed architectures, and large developer pools."},
            {"name": "Google India", "category": "oem", "tier_level": "Tier 1", "tier": "Tier-1 Hyperscaler OEM", "location": "Bangalore / Hyderabad", "description": "Hyperscale distributed systems, cloud infrastructure, and search platform engineering.", "domain_specialties": ["Distributed Systems", "Python", "Go", "High-throughput APIs"], "why_recommended": "Top-tier hyperscaler engineering center known for high-concurrency systems, rigorous algorithmic foundations, and operational scale."},
            {"name": "Amazon Development Center", "category": "oem", "tier_level": "Tier 1", "tier": "Tier-1 E-Commerce & Cloud OEM", "location": "Bangalore / Hyderabad / Chennai", "description": "Distributed cloud architectures, backend systems, and high-throughput microservices.", "domain_specialties": ["Microservices", "Java / Spring Boot", "AWS", "Distributed Architectures"], "why_recommended": "High-velocity product engineering hub developing resilient microservices and distributed transactional platforms."},
            {"name": "Adobe India", "category": "oem", "tier_level": "Tier 1", "tier": "Tier-1 Creative & Document Tech OEM", "location": "Noida / Bangalore", "description": "Cloud platform engineering, rich web application architectures, and multimedia services.", "domain_specialties": ["React / Frontend", "Cloud Platforms", "C++ / Java", "API Architectures"], "why_recommended": "Exceptional talent pool in complex frontend web applications, cloud platform engineering, and developer tooling."},
            {"name": "Atlassian India", "category": "oem", "tier_level": "Tier 1", "tier": "Tier-1 Collaboration Tech OEM", "location": "Bangalore", "description": "Enterprise collaboration platforms, microservices, and distributed cloud systems.", "domain_specialties": ["Java / Kotlin", "React / TypeScript", "Microservices", "Cloud Reliability"], "why_recommended": "Modern cloud-native engineering culture with deep talent in full-stack microservices and distributed team tools."},
            {"name": "Thoughtworks", "category": "gsi", "tier_level": "Tier 2", "tier": "Tier-2 Agile & Digital Engineering Consultancy", "location": "Bangalore / Pune / Hyderabad", "description": "Modern software delivery, evolutionary architectures, and agile engineering practices.", "domain_specialties": ["Clean Code", "Microservices", "Agile Engineering", "Full-Stack Web"], "why_recommended": "Pioneering technology consultancy renowned for test-driven development, evolutionary architectures, and engineering craft."},
            {"name": "Persistent Systems", "category": "gsi", "tier_level": "Tier 2", "tier": "Tier-2 Digital Product Engineering Leader", "location": "Pune / Bangalore / Hyderabad", "description": "Digital product engineering, enterprise modernization, and cloud development services.", "domain_specialties": ["Product Engineering", "Java / Spring", "Cloud Modernization", "API Integration"], "why_recommended": "Specialized product engineering partner with experienced developers building enterprise SaaS and cloud platforms."},
            {"name": "Accenture", "category": "gsi", "tier_level": "Tier 2", "tier": "Tier-2 Global Integrator Leader", "location": "Bangalore / Hyderabad / Pune", "description": "End-to-end technology transformation and managed delivery services.", "domain_specialties": ["Enterprise Architecture", "Java / Spring Boot", "Microservices", "Cloud Applications"], "why_recommended": "Massive enterprise engineering bench delivering complex application modernization and scalable cloud integrations."},
            {"name": "TCS", "category": "gsi", "tier_level": "Tier 2", "tier": "Tier-2 Global Tier 1 GSI", "location": "Mumbai / Bangalore / Chennai", "description": "Global IT services, digital transformation, and enterprise consulting.", "domain_specialties": ["Enterprise Java", "Full Stack Development", "SQL / Databases", "Integration APIs"], "why_recommended": "Extensive engineering capacity with certified software engineers skilled in multi-platform enterprise software."},
            {"name": "Infosys", "category": "gsi", "tier_level": "Tier 2", "tier": "Tier-2 Global Tier 1 GSI", "location": "Bangalore / Hyderabad / Pune", "description": "Digital services, cloud platforms, and enterprise solutions.", "domain_specialties": ["Cloud Platforms", "Java / Spring", "React / Frontend", "REST APIs"], "why_recommended": "Broad software engineering bench delivering robust enterprise platforms, web applications, and database integrations."},
            {"name": "Nagarro", "category": "gsi", "tier_level": "Tier 3", "tier": "Tier-3 Agile Engineering Specialist", "location": "Gurgaon / Bangalore", "description": "Fluidic enterprise engineering, agile custom development, and cloud services.", "domain_specialties": ["Agile Development", "Custom Software", "Modern Stacks", "API Design"], "why_recommended": "Agile software studio with skilled engineers delivering rapid custom software development and cloud modernizations."},
            {"name": "GlobalLogic", "category": "gsi", "tier_level": "Tier 3", "tier": "Tier-3 Digital Product Engineering Co.", "location": "Noida / Bangalore / Hyderabad", "description": "Full-lifecycle product development, UX design, and cloud software engineering.", "domain_specialties": ["Product Development", "Full Stack Web", "Microservices", "Cloud Stacks"], "why_recommended": "Digital product engineering house building customer-facing web and mobile applications with high engineering standards."},
        ],
    },

    # 6. Cloud Infrastructure, DevOps & SRE
    {
        "id": "cloud_infrastructure",
        "name": "Cloud Architecture, DevOps, SRE & Platform Engineering",
        "domains": ["cloud_infrastructure", "cloud_devops", "devops"],
        "keywords": ["aws", "azure", "gcp", "cloud", "devops", "kubernetes", "docker", "terraform", "ci/cd", "sre", "infrastructure as code", "ansible"],
        "primary_strategy": "Technology / Tool-Based Sourcing",
        "strategy_rationale": "Cloud infrastructure and DevOps talent is centered in cloud provider engineering hubs, dedicated cloud transformation consultancies, and premier cloud boutiques.",
        "companies": [
            {"name": "Amazon Web Services (AWS India)", "category": "oem", "tier_level": "Tier 1", "tier": "Tier-1 Cloud Hyperscaler OEM", "location": "Bangalore / Hyderabad / Mumbai", "description": "Core cloud infrastructure, container services, and developer tooling.", "domain_specialties": ["AWS Architecture", "Kubernetes (EKS)", "Cloud Infrastructure", "Terraform"], "why_recommended": "Primary cloud hyperscaler with authoritative talent in distributed cloud infrastructure, VPC networking, and container orchestration."},
            {"name": "Microsoft Azure India", "category": "oem", "tier_level": "Tier 1", "tier": "Tier-1 Cloud Platform OEM", "location": "Hyderabad / Bangalore", "description": "Azure cloud services, hybrid infrastructure, and enterprise DevOps.", "domain_specialties": ["Azure DevOps", "Kubernetes (AKS)", "Cloud Security", "ARM / Bicep"], "why_recommended": "Top enterprise cloud provider with deep bench in Azure architecture, identity federation, and automated CI/CD pipelines."},
            {"name": "Google Cloud (GCP India)", "category": "oem", "tier_level": "Tier 1", "tier": "Tier-1 Hyperscaler Cloud OEM", "location": "Bangalore / Hyderabad", "description": "Google Cloud infrastructure, Anthos, and site reliability engineering.", "domain_specialties": ["GCP", "Kubernetes (GKE)", "SRE Methodologies", "Terraform"], "why_recommended": "Pioneer in Site Reliability Engineering (SRE) and container ecosystems; unmatched source for high-reliability engineers."},
            {"name": "Red Hat India", "category": "oem", "tier_level": "Tier 1", "tier": "Tier-1 Open Source & Container OEM", "location": "Pune / Bangalore", "description": "OpenShift container platform, Ansible automation, and Linux enterprise systems.", "domain_specialties": ["OpenShift", "Ansible Automation", "Linux Core", "Kubernetes"], "why_recommended": "Industry authority on container orchestration, OpenShift, and automated configuration management."},
            {"name": "Accenture Cloud First", "category": "gsi", "tier_level": "Tier 2", "tier": "Tier-2 Cloud Transformation Leader", "location": "Bangalore / Hyderabad / Pune", "description": "Multi-cloud migration, automated DevOps landing zones, and cloud governance.", "domain_specialties": ["Multi-Cloud Migration", "Terraform", "CI/CD Automation", "Cloud Security"], "why_recommended": "Largest dedicated cloud migration practice in India with extensive multi-cloud certifications."},
            {"name": "Deloitte Cloud Engineering", "category": "big4", "tier_level": "Tier 2", "tier": "Tier-2 Advisory Cloud Engineering", "location": "Hyderabad / Bangalore / Mumbai", "description": "Enterprise cloud strategy, cloud architecture, and DevSecOps governance.", "domain_specialties": ["Cloud Governance", "DevSecOps", "Cloud Architecture", "Landing Zones"], "why_recommended": "Premier advisory cloud practice skilled in enterprise landing zones, DevSecOps compliance, and cloud migrations."},
            {"name": "Wipro FullStride Cloud", "category": "gsi", "tier_level": "Tier 2", "tier": "Tier-2 Cloud Services Practice", "location": "Bangalore / Chennai / Hyderabad", "description": "Hybrid cloud deployments, infrastructure automation, and SRE operations.", "domain_specialties": ["Hybrid Cloud", "Infrastructure Automation", "SRE", "Containerization"], "why_recommended": "Dedicated cloud services division with deep talent bench in hybrid cloud and automated operations."},
            {"name": "Searce", "category": "gsi", "tier_level": "Tier 3", "tier": "Tier-3 Cloud Modernization Boutique", "location": "Pune / Bangalore", "description": "Pure-play cloud modernization, Google Cloud & AWS premier partner.", "domain_specialties": ["Cloud Modernization", "Terraform IaC", "Kubernetes", "DevOps Pipelines"], "why_recommended": "Agile cloud consultancy specializing in cloud-native migrations, containerization, and modern CI/CD."},
            {"name": "CloudThat", "category": "gsi", "tier_level": "Tier 3", "tier": "Tier-3 Cloud Solutions & Training CoE", "location": "Bangalore", "description": "Cloud consulting, DevOps automation, and specialized cloud enablement.", "domain_specialties": ["DevOps Automation", "Cloud Architecture", "AWS / Azure", "IaC"], "why_recommended": "Focused cloud consultancy with deeply certified cloud engineers and automated deployment specialists."},
        ],
    },

    # 7. ServiceNow Financial Services Operations & Workflow Modernization
    {
        "id": "servicenow_fso",
        "name": "ServiceNow Financial Workflows & Enterprise Platforms",
        "domains": ["servicenow", "itsm", "financial_services"],
        "keywords": ["servicenow", "fso", "complaint management", "financial services operations", "flow designer", "csm", "snow"],
        "primary_strategy": "Technology / Tool-Based Sourcing",
        "strategy_rationale": "ServiceNow FSO requires deep certified platform expertise; sourcing from elite implementation partners and financial GCCs yields the highest qualification rate.",
        "companies": [
            {"name": "ServiceNow IDC", "category": "oem", "tier_level": "Tier 1", "tier": "Platform Software OEM", "location": "Hyderabad / Bangalore", "description": "Core product engineering, FSO platform development, and workflow architecture.", "domain_specialties": ["ServiceNow Core", "Flow Designer", "FSO Platform", "CSM"], "why_recommended": "Core product engineering hub creating the ServiceNow FSO framework and enterprise workflow components."},
            {"name": "Deloitte", "category": "big4", "tier_level": "Tier 2", "tier": "Global Elite Partner", "location": "Hyderabad / Bangalore / Mumbai", "description": "Leading ServiceNow FSO and financial transformation practice with deep banking domain expertise.", "domain_specialties": ["ServiceNow FSO", "Banking Workflows", "Dispute Handling", "ITSM"], "why_recommended": "Top-tier global implementation partner with dedicated banking workflow automation and dispute management practices."},
            {"name": "PwC", "category": "big4", "tier_level": "Tier 2", "tier": "Global Elite Partner", "location": "Bangalore / Hyderabad / Kolkata", "description": "Banking regulatory workflows, complaint handling, and ServiceNow case management.", "domain_specialties": ["Case Management", "Complaint Tracking", "Regulatory Workflows", "ServiceNow"], "why_recommended": "Premier regulatory advisory with extensive experience deploying ServiceNow complaint handling in global banks."},
            {"name": "EY", "category": "big4", "tier_level": "Tier 2", "tier": "Global Elite Partner", "location": "Bangalore / Gurgaon / Mumbai", "description": "Financial risk, compliance automation, and digital enterprise workflow delivery.", "domain_specialties": ["Compliance Automation", "Digital Workflows", "Risk Workflows", "ServiceNow FSO"], "why_recommended": "Specialized banking advisory delivering risk and compliance workflow modernizations on ServiceNow."},
            {"name": "Cognizant", "category": "gsi", "tier_level": "Tier 2", "tier": "Global Elite Partner", "location": "Chennai / Hyderabad / Bangalore", "description": "4,000+ certified ServiceNow specialists with financial services CoE.", "domain_specialties": ["Certified ServiceNow Bench", "ITSM / CSM", "FSO Implementations", "Flows"], "why_recommended": "One of the largest pools of certified ServiceNow professionals with proven banking delivery record."},
            {"name": "Accenture", "category": "gsi", "tier_level": "Tier 2", "tier": "Global Elite Leader", "location": "Bangalore / Hyderabad / Pune", "description": "Large-scale ServiceNow banking modernization and complaint tracking implementations.", "domain_specialties": ["Banking Modernization", "ServiceNow Architecture", "CSM", "FSO"], "why_recommended": "Market leader in enterprise-wide ServiceNow digital transformation and complex financial workflows."},
            {"name": "Barclays Technology Center", "category": "gcc", "tier_level": "Tier 1", "tier": "Banking GCC Hub", "location": "Pune / Mumbai", "description": "In-house banking workflow automation, dispute management, and ServiceNow platform center.", "domain_specialties": ["In-House Banking Flows", "Dispute Resolution", "ServiceNow Core", "FSO Operations"], "why_recommended": "Direct in-house banking engineering center running high-volume operational dispute and complaint systems."},
            {"name": "Standard Chartered GBS", "category": "gcc", "tier_level": "Tier 1", "tier": "Global Banking GCC", "location": "Bangalore / Chennai", "description": "Core client servicing, dispute handling, and enterprise workflow engineering.", "domain_specialties": ["Client Servicing", "Banking Operations", "Dispute Workflows", "ServiceNow"], "why_recommended": "Global shared services hub maintaining core banking transaction workflows and client service case routing."},
        ],
    },

    # 8. Oracle EPM / Hyperion / FCCS / Financial Consolidation
    {
        "id": "oracle_epm_fccs",
        "name": "Oracle EPM, FCCS & Financial Consolidation Ecosystem",
        "domains": ["oracle_epm", "fccs"],
        "keywords": ["oracle", "epm", "hyperion", "fccs", "financial consolidation", "essbase", "smart view", "pbcs", "financial close"],
        "primary_strategy": "Tier-1 Competitors & Parallel Ecosystems",
        "strategy_rationale": "Financial close and FCCS consolidation consulting talent is concentrated in Big 4 advisory practices and specialized Oracle partner organizations.",
        "companies": [
            {"name": "Oracle IDC", "category": "oem", "tier_level": "Tier 1", "tier": "Software OEM IDC", "location": "Bangalore / Hyderabad", "description": "Core Oracle Cloud EPM, FCCS, and Essbase product engineering center.", "domain_specialties": ["Oracle Cloud EPM", "FCCS", "Essbase", "Financial Close"], "why_recommended": "Product engineering creators of Oracle Cloud EPM and Essbase; authoritative technical depth."},
            {"name": "Deloitte", "category": "big4", "tier_level": "Tier 2", "tier": "Global EPM Leader", "location": "Hyderabad / Bangalore / Mumbai", "description": "Top Oracle EPM financial close & consolidation transformation practice.", "domain_specialties": ["FCCS Implementation", "Financial Consolidation", "Smart View", "Statutory Close"], "why_recommended": "Top-tier Oracle EPM advisory practice delivering financial consolidation and close transformations."},
            {"name": "PwC", "category": "big4", "tier_level": "Tier 2", "tier": "Global Advisory", "location": "Bangalore / Hyderabad / Kolkata", "description": "Regulatory consolidation, statutory close, and FCCS implementation CoE.", "domain_specialties": ["Statutory Close", "FCCS", "Consolidation Rules", "EPM"], "why_recommended": "Extensive practice specializing in multi-GAAP financial consolidations and regulatory close reporting."},
            {"name": "EY", "category": "big4", "tier_level": "Tier 2", "tier": "Advisory Leader", "location": "Bangalore / Gurgaon / Mumbai", "description": "Financial performance management, FCCS, and enterprise reporting practice.", "domain_specialties": ["Enterprise Reporting", "FCCS", "Hyperion", "Performance Management"], "why_recommended": "Deep expertise in enterprise performance reporting, financial consolidation, and Hyperion migrations."},
            {"name": "KPMG", "category": "big4", "tier_level": "Tier 2", "tier": "EPM Advisory Partner", "location": "Bangalore / Mumbai / Pune", "description": "Planning, budgeting, and statutory financial close advisory.", "domain_specialties": ["Planning & Budgeting", "Statutory Close", "PBCS", "Essbase"], "why_recommended": "Strong advisory practice in corporate financial planning, Essbase modeling, and close governance."},
            {"name": "Accenture", "category": "gsi", "tier_level": "Tier 2", "tier": "Global Platinum Partner", "location": "Bangalore / Hyderabad / Pune", "description": "Largest Oracle Cloud EPM delivery practice in India.", "domain_specialties": ["Oracle Cloud EPM", "FCCS Delivery", "EPM Integration", "Essbase"], "why_recommended": "Scalable global delivery bench for large-scale enterprise Oracle Cloud EPM rollouts."},
            {"name": "Genpact", "category": "gsi", "tier_level": "Tier 2", "tier": "Record-to-Report Specialist", "location": "Hyderabad / Gurgaon / Bangalore", "description": "Enterprise finance operations with deep Hyperion and EPM CoE.", "domain_specialties": ["Hyperion Essbase", "R2R Reporting", "Financial Consolidations", "Smart View"], "why_recommended": "Direct operational finance practitioners running month-end close and consolidation on Hyperion."},
            {"name": "American Express GCC", "category": "gcc", "tier_level": "Tier 1", "tier": "Global Financial GCC", "location": "Gurgaon / Bangalore", "description": "Enterprise financial planning, Hyperion Essbase analytics, and close reporting.", "domain_specialties": ["Hyperion Essbase", "Financial Analytics", "Close Reporting", "Planning"], "why_recommended": "Direct in-house corporate finance team managing enterprise financial consolidations and close analytics."},
        ],
    },

    # 9. VLSI, Silicon, FPGA & Avionics DO-254
    {
        "id": "vlsi_semiconductor",
        "name": "Semiconductor Silicon, FPGA & Avionics Hardware",
        "domains": ["vlsi", "semiconductor", "hardware"],
        "keywords": ["vlsi", "fpga", "systemverilog", "uvm", "verification", "do-254", "asic", "avionics", "rtl", "soc"],
        "primary_strategy": "Technology / Tool-Based Sourcing",
        "strategy_rationale": "Safety-critical avionics verification and SystemVerilog UVM talent resides in semiconductor OEMs, EDA leaders, and specialized DO-254 engineering labs.",
        "companies": [
            {"name": "Cadence Design Systems", "category": "oem", "tier_level": "Tier 1", "tier": "EDA Tool OEM", "location": "Noida / Bangalore / Pune", "description": "Verification IP, formal verification, and EDA simulation tool development.", "domain_specialties": ["EDA Tools", "Formal Verification", "SystemVerilog", "VIP"], "why_recommended": "Core creator of EDA verification and simulation platforms; authoritative source for verification architects."},
            {"name": "Synopsys", "category": "oem", "tier_level": "Tier 1", "tier": "EDA & IP OEM", "location": "Bangalore / Hyderabad / Noida", "description": "UVM verification methodology, VIP design, and emulation systems.", "domain_specialties": ["UVM Methodology", "VIP Design", "SystemVerilog", "Emulation"], "why_recommended": "World leader in UVM verification methodologies and complex silicon verification IP."},
            {"name": "AMD (Xilinx)", "category": "oem", "tier_level": "Tier 1", "tier": "FPGA OEM Leader", "location": "Hyderabad / Bangalore", "description": "FPGA architecture, Vivado tools, and adaptive SoC verification engineering.", "domain_specialties": ["FPGA Design", "Vivado", "SystemVerilog", "SoC Verification"], "why_recommended": "Premier FPGA silicon creator with elite talent in complex programmable logic and hardware verification."},
            {"name": "Intel", "category": "oem", "tier_level": "Tier 1", "tier": "Semiconductor OEM", "location": "Bangalore", "description": "FPGA design, Quartus Prime, and complex silicon verification.", "domain_specialties": ["FPGA Architecture", "Quartus", "UVM", "ASIC Verification"], "why_recommended": "Deep engineering talent in high-performance silicon, complex FPGA implementations, and RTL design."},
            {"name": "Qualcomm", "category": "oem", "tier_level": "Tier 1", "tier": "Silicon OEM Hub", "location": "Hyderabad / Bangalore / Chennai", "description": "Advanced SystemVerilog/UVM SoC verification engineering.", "domain_specialties": ["SoC Verification", "SystemVerilog / UVM", "Complex RTL", "Coverage Closure"], "why_recommended": "Elite mobile and automotive SoC design center with rigorous UVM coverage closure specialists."},
            {"name": "eInfochips (Arrow)", "category": "gsi", "tier_level": "Tier 2", "tier": "DO-254 Specialist", "location": "Ahmedabad / Bangalore / Pune", "description": "Dedicated aerospace DO-254 hardware & FPGA verification lab.", "domain_specialties": ["DO-254 Avionics", "Safety-Critical FPGA", "SystemVerilog", "Hardware Testing"], "why_recommended": "Specialized aerospace DO-254 design and verification laboratory with deep avionics compliance experience."},
            {"name": "Tata Elxsi", "category": "gsi", "tier_level": "Tier 2", "tier": "Aerospace Systems Partner", "location": "Bangalore / Trivandrum", "description": "Avionics DO-254 certification and safety-critical FPGA designs.", "domain_specialties": ["Avionics DO-254", "Safety-Critical Design", "FPGA Verification", "VHDL/Verilog"], "why_recommended": "Premier aerospace engineering partner delivering DO-254 certified airborne hardware solutions."},
            {"name": "Wipro VLSI", "category": "gsi", "tier_level": "Tier 2", "tier": "VLSI Design Services", "location": "Bangalore / Hyderabad", "description": "2,500+ VLSI engineers with deep digital ASIC/FPGA verification capabilities.", "domain_specialties": ["Digital ASIC", "FPGA Verification", "UVM Testbenches", "SystemVerilog"], "why_recommended": "Massive dedicated VLSI practice with scalable benches of qualified SystemVerilog and UVM verification engineers."},
        ],
    },

    # 10. SAP Cloud Platform Integration (CPI) & Enterprise Integration Suite
    {
        "id": "sap_integration_cpi",
        "name": "SAP Integration Suite, CPI & Cloud Modernization",
        "domains": ["sap", "integration", "enterprise"],
        "keywords": ["sap cpi", "sap integration suite", "groovy", "odata", "cpi", "cloud platform integration", "bapi"],
        "primary_strategy": "Tier-1 Competitors & Parallel Ecosystems",
        "strategy_rationale": "Enterprise integration talent is centered in premier SAP consulting practices and enterprise global capability centers.",
        "companies": [
            {"name": "SAP Labs India", "category": "oem", "tier_level": "Tier 1", "tier": "Software OEM IDC", "location": "Bangalore / Gurgaon", "description": "Core SAP BTP, CPI, and Integration Suite product engineering.", "domain_specialties": ["SAP BTP", "SAP CPI", "Integration Suite", "Groovy"], "why_recommended": "Core product engineering center for SAP Integration Suite; authoritative platform design expertise."},
            {"name": "Deloitte", "category": "big4", "tier_level": "Tier 2", "tier": "Global SAP Partner", "location": "Hyderabad / Bangalore / Mumbai", "description": "Tier-1 SAP S/4HANA and cloud integration transformation practice.", "domain_specialties": ["SAP S/4HANA", "Cloud Integration", "CPI Flows", "OData"], "why_recommended": "Premier global SAP integration practice with extensive enterprise cloud modernization deployments."},
            {"name": "PwC", "category": "big4", "tier_level": "Tier 2", "tier": "Strategic Partner", "location": "Bangalore / Hyderabad / Kolkata", "description": "Enterprise cloud integration, CPI architectures, and BTP modernization.", "domain_specialties": ["BTP Modernization", "CPI Architectures", "Enterprise Middleware", "SAP"], "why_recommended": "Strategic SAP partner delivering regulatory compliant cloud integrations and legacy middleware migration."},
            {"name": "Infosys", "category": "gsi", "tier_level": "Tier 2", "tier": "Global Premier Partner", "location": "Bangalore / Hyderabad / Pune", "description": "Infosys Cobalt SAP integration CoE with certified CPI consultants.", "domain_specialties": ["Certified CPI Bench", "SAP BTP", "Cobalt Cloud", "Integration Flows"], "why_recommended": "Massive certified SAP CPI practice delivering rapid integration flows and enterprise cloud bridges."},
            {"name": "Accenture", "category": "gsi", "tier_level": "Tier 2", "tier": "Strategic Innovator", "location": "Bangalore / Hyderabad / Pune", "description": "Largest SAP Cloud integration and BTP delivery practice in India.", "domain_specialties": ["SAP Cloud Integration", "BTP Delivery", "Groovy Mapping", "Enterprise APIs"], "why_recommended": "Market leader in complex SAP CPI enterprise migrations, Groovy script mapping, and API management."},
            {"name": "TCS", "category": "gsi", "tier_level": "Tier 2", "tier": "Global Tier 1 Partner", "location": "Mumbai / Bangalore / Chennai", "description": "Enterprise hybrid integration, SAP CPI migration, and legacy middleware sunsetting.", "domain_specialties": ["Hybrid Integration", "CPI Migration", "Middleware Sunsetting", "SAP ERP"], "why_recommended": "Extensive integration capacity with certified consultants migrating legacy middleware to SAP CPI."},
            {"name": "Bayer Global Capability Center", "category": "gcc", "tier_level": "Tier 1", "tier": "Life Sciences GCC", "location": "Bangalore / Hyderabad", "description": "Global SAP ERP integration, cloud middleware, and BTP operations.", "domain_specialties": ["SAP ERP Integration", "Cloud Middleware", "BTP Operations", "Global APIs"], "why_recommended": "Dedicated life sciences capability center running enterprise SAP BTP and cross-border API integrations."},
        ],
    },
]

# Fallback general technology & consulting catalog with rich company profiles
DEFAULT_GENERAL_CATALOG: Dict[str, Any] = {
    "id": "general_enterprise",
    "name": "General Enterprise Technology & Systems Consulting",
    "primary_strategy": "Similar Job Function",
    "strategy_rationale": "For broad technology requirements, prioritize tier-1 systems integrators and enterprise technology centers with multi-disciplinary talent pools.",
    "companies": [
        {"name": "Microsoft IDC", "category": "oem", "tier_level": "Tier 1", "tier": "Technology OEM", "location": "Hyderabad / Bangalore / Noida", "description": "Enterprise cloud, software architecture, and developer platforms.", "domain_specialties": ["Cloud Systems", "Microservices", "Developer Platforms", "Architecture"]},
        {"name": "Google India", "category": "oem", "tier_level": "Tier 1", "tier": "Hyperscaler OEM", "location": "Bangalore / Hyderabad", "description": "Cloud systems, distributed services, and engineering infrastructure.", "domain_specialties": ["Distributed Computing", "Cloud Infrastructure", "API Platforms", "Scalability"]},
        {"name": "Amazon Development Center", "category": "oem", "tier_level": "Tier 1", "tier": "Technology OEM", "location": "Bangalore / Hyderabad / Chennai", "description": "Distributed cloud architectures, backend systems, and operational excellence.", "domain_specialties": ["Backend Systems", "Cloud Architecture", "Distributed Services", "Operations"]},
        {"name": "Deloitte", "category": "big4", "tier_level": "Tier 2", "tier": "Big 4 Advisory Leader", "location": "Hyderabad / Bangalore / Mumbai", "description": "Enterprise advisory, business process re-engineering, and technology consulting.", "domain_specialties": ["Enterprise Advisory", "Business Process", "Consulting", "Transformation"]},
        {"name": "PwC", "category": "big4", "tier_level": "Tier 2", "tier": "Global Advisory", "location": "Bangalore / Hyderabad / Kolkata", "description": "Technology transformation, systems advisory, and risk consulting.", "domain_specialties": ["Systems Advisory", "Risk Consulting", "Technology Transformation", "Governance"]},
        {"name": "EY", "category": "big4", "tier_level": "Tier 2", "tier": "Advisory Practice", "location": "Bangalore / Gurgaon / Mumbai", "description": "Business transformation, enterprise systems, and operational consulting.", "domain_specialties": ["Enterprise Systems", "Business Transformation", "Operational Consulting", "Compliance"]},
        {"name": "KPMG", "category": "big4", "tier_level": "Tier 2", "tier": "Advisory Firm", "location": "Bangalore / Mumbai / Pune", "description": "Enterprise systems, digital strategy, and management consulting.", "domain_specialties": ["Digital Strategy", "Enterprise Systems", "Management Consulting", "Advisory"]},
        {"name": "Accenture", "category": "gsi", "tier_level": "Tier 2", "tier": "Global Integrator Leader", "location": "Bangalore / Hyderabad / Pune", "description": "End-to-end technology transformation and managed delivery services.", "domain_specialties": ["Managed Delivery", "End-to-end Transformation", "Enterprise Architecture", "Operations"]},
        {"name": "TCS", "category": "gsi", "tier_level": "Tier 2", "tier": "Global Tier 1 GSI", "location": "Mumbai / Bangalore / Chennai", "description": "Global IT services, digital transformation, and enterprise consulting.", "domain_specialties": ["Digital Transformation", "IT Services", "Enterprise Consulting", "Delivery Bench"]},
        {"name": "Infosys", "category": "gsi", "tier_level": "Tier 2", "tier": "Global Tier 1 GSI", "location": "Bangalore / Hyderabad / Pune", "description": "Digital services, cloud platforms, and enterprise solutions.", "domain_specialties": ["Cloud Platforms", "Enterprise Solutions", "Digital Services", "Integration"]},
        {"name": "Wipro", "category": "gsi", "tier_level": "Tier 2", "tier": "Global Tier 1 GSI", "location": "Bangalore / Hyderabad / Chennai", "description": "IT services, enterprise infrastructure, and digital consulting.", "domain_specialties": ["IT Infrastructure", "Enterprise Systems", "Digital Consulting", "Managed Services"]},
        {"name": "Cognizant", "category": "gsi", "tier_level": "Tier 2", "tier": "Global Tier 1 GSI", "location": "Chennai / Hyderabad / Bangalore", "description": "Technology consulting, operations, and domain solutions.", "domain_specialties": ["Technology Consulting", "Domain Solutions", "Operations", "Enterprise Delivery"]},
        {"name": "JPMorgan Chase GCC", "category": "gcc", "tier_level": "Tier 1", "tier": "Top Financial GCC", "location": "Bangalore / Hyderabad / Mumbai", "description": "Global banking technology, operational systems, and financial engineering.", "domain_specialties": ["Financial Operations", "Operational Systems", "Institutional Technology", "Controls"]},
        {"name": "Walmart Global Tech", "category": "gcc", "tier_level": "Tier 1", "tier": "Retail Tech Hub", "location": "Bangalore / Chennai", "description": "Global retail supply chain, e-commerce systems, and data operations.", "domain_specialties": ["Retail Systems", "Supply Chain Operations", "Data Operations", "Enterprise Tech"]},
    ],
}


def _compute_dynamic_skills_and_reason(
    co: Dict[str, Any],
    job_title: str,
    jd_skills: List[str],
    domain_label: str,
    company_idx: int,
    total_cos: int,
) -> Tuple[List[str], str]:
    """Dynamically assign distinct, non-constant overlap skills and a unique why_recommended sentence for this company and JD."""
    co_name = co.get("name", "Target Company")
    co_cat = co.get("category", "other")
    tier_level = co.get("tier_level", "Tier 2")
    tier = co.get("tier", f"{tier_level} Sourcing Pool")
    company_specialties = co.get("domain_specialties", [])

    # 1. Compute dynamic, non-identical Overlap Skills
    assigned_skills: List[str] = []

    # Check for direct overlap between this company's known specialties and the JD's extracted skills
    if jd_skills:
        # Match case-insensitively
        direct_matches = [
            s for s in jd_skills
            if any(s.lower() in spec.lower() or spec.lower() in s.lower() for spec in company_specialties)
        ]

        if direct_matches:
            assigned_skills = direct_matches[:4]

        # If direct matches are fewer than 3, select distinct skills from the JD using round-robin offset
        if len(assigned_skills) < 3 and len(jd_skills) >= 2:
            offset = (company_idx * 2) % len(jd_skills)
            rotated_skills = jd_skills[offset:] + jd_skills[:offset]
            for s in rotated_skills:
                if s not in assigned_skills:
                    assigned_skills.append(s)
                if len(assigned_skills) >= 4:
                    break

    # If still empty or no JD skills extracted, use company specialties or domain-grounded terms
    if not assigned_skills:
        assigned_skills = company_specialties[:4] if company_specialties else [f"{domain_label} Competencies", "Core Operations"]

    skills_str = ", ".join(assigned_skills[:4])

    # 2. Check if company has an existing hand-crafted bespoke reason
    if co.get("why_recommended") and ("{" not in co["why_recommended"]):
        # If hand-crafted reason already exists and is specific, return it
        return assigned_skills, co["why_recommended"]

    # 3. Generate dynamic, non-repeating why_recommended sentence tailored to this company and this exact JD
    # We use varied phrasing templates keyed by category and company index to guarantee high textual diversity
    role_noun = job_title if job_title else "specialists"

    if co_cat == "big4":
        templates = [
            f"Tier-1 advisory and assurance practice with proven client-facing exposure in {skills_str}; primary talent source for {role_noun} candidates with strong audit readiness.",
            f"Renowned professional services firm maintaining a premier bench of {role_noun} practitioners skilled in {skills_str} and regulatory governance.",
            f"Leading consulting practice with extensive hands-on delivery in {skills_str}; exceptional ground for headhunting rigorous {role_noun} professionals.",
            f"High-caliber advisory practice recognized for deep technical governance in {skills_str} across multi-entity enterprise operations.",
        ]
        reason = templates[company_idx % len(templates)]
    elif co_cat == "gcc":
        templates = [
            f"Institutional enterprise capability center with deep internal workflows in {skills_str}; key source for operational {role_noun} talent handling high-volume workflows.",
            f"Captive enterprise global center running core daily operations in {skills_str}; proven source for structured and process-driven {role_noun} practitioners.",
            f"Dedicated global technology and operational hub maintaining strict governance in {skills_str} for mission-critical enterprise functions.",
            f"High-rigor corporate capability center with deep hands-on expertise in {skills_str} and end-to-end controllership.",
        ]
        reason = templates[company_idx % len(templates)]
    elif co_cat in ["oem", "product"]:
        templates = [
            f"Platform creator and software engineering center with authoritative technical expertise in {skills_str}; premier source for senior {role_noun} practitioners.",
            f"Leading technology OEM developing core platforms in {skills_str}; unmatched technical bench for high-complexity {role_noun} requirements.",
            f"Tier-1 product engineering hub maintaining high architectural standards in {skills_str} and scalable operational tooling.",
        ]
        reason = templates[company_idx % len(templates)]
    elif co_cat in ["agency", "creative"]:
        templates = [
            f"Top creative agency network delivering high-impact commercial campaigns; primary headhunting ground for {role_noun} talent skilled in {skills_str}.",
            f"Integrated creative and visual production studio with an award-winning bench of {role_noun} professionals delivering {skills_str}.",
            f"Specialized creative studio renowned for contemporary visual craftsmanship, brand narratives, and {skills_str}.",
        ]
        reason = templates[company_idx % len(templates)]
    elif co_cat == "retail":
        templates = [
            f"High-volume e-commerce and retail operator with dedicated teams executing {skills_str} across large-scale consumer catalogs.",
            f"Enterprise retail operations hub managing complex vendor networks and rapid execution of {skills_str}.",
            f"Leading retail center with proven operational workflows in {skills_str} and master data remediation.",
        ]
        reason = templates[company_idx % len(templates)]
    else:  # gsi or general consulting
        templates = [
            f"Established global systems integrator with a scalable delivery bench of {role_noun} professionals experienced in enterprise {skills_str}.",
            f"Tier-1 technology services provider with an extensive certified talent bench in {skills_str} across global client engagements.",
            f"Global consulting and managed services leader delivering end-to-end operational execution and system expertise in {skills_str}.",
            f"Enterprise systems integrator with proven delivery capacity in {skills_str} and cross-functional operational documentation.",
        ]
        reason = templates[company_idx % len(templates)]

    return assigned_skills, reason


def get_target_company_recommendations_for_job(
    db: Session,
    job_id: int,
    selected_strategy: Optional[str] = None,
    custom_companies: Optional[List[Dict[str, Any]]] = None,
    excluded_companies: Optional[List[str]] = None,
    off_limits_companies: Optional[List[str]] = None,
) -> Dict[str, Any]:
    """Analyze a job description and generate dynamic, explainable target company recommendations."""
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        return {"error": "Job not found", "companies": []}

    source_jd = (
        db.query(JobDescription).filter(JobDescription.id == job.job_description_id).first()
        if job.job_description_id
        else None
    )
    raw_text = source_jd.original_text if source_jd and source_jd.original_text else job.description or ""
    title = job.title or ""

    # Extract domain intelligence
    domain_id, domain_meta = detect_jd_domain(title, raw_text)
    extraction = extract_skills_from_jd(raw_text, title=title, use_ai=False)

    haystack = f"{title} {raw_text} {' '.join(job.required_skills or [])}".lower()

    # Collect comprehensive extracted skills from the JD text with highest priority
    mandatory_skills = extraction.get("mandatory_skills", [])
    preferred_skills = extraction.get("preferred_skills", [])
    
    # If the JD text produced extracted skills, prioritize them exclusively over stale DB columns
    if mandatory_skills:
        skill_candidates = mandatory_skills + preferred_skills
    else:
        skill_candidates = list(job.required_skills or []) + list(job.preferred_skills or [])
    
    # Combined deduplicated skills specific to this job
    all_jd_skills: List[str] = []
    seen_skills = set()
    for s in skill_candidates:
        s_clean = s.strip()
        if s_clean and s_clean.lower() not in seen_skills:
            seen_skills.add(s_clean.lower())
            all_jd_skills.append(s_clean)

    # Match relevant ecosystem from verified corporate catalogs
    matched_ecosystems: List[Dict[str, Any]] = []
    for eco in COMPANY_ECOSYSTEMS_CATALOG:
        has_domain = domain_id in eco.get("domains", [])
        has_kw = any(re.search(r"(?:\b|_)" + re.escape(kw) + r"(?:\b|_)", haystack) for kw in eco.get("keywords", []))
        if has_domain or has_kw:
            matched_ecosystems.append(eco)

    primary_ecosystem = matched_ecosystems[0] if matched_ecosystems else DEFAULT_GENERAL_CATALOG
    
    # If using fallback general catalog, tailor its title dynamically to the role
    ecosystem_name = primary_ecosystem.get("name", "Target Corporate Sourcing Ecosystem")
    if not matched_ecosystems and title:
        ecosystem_name = f"{title} Talent Sourcing Ecosystem"

    sourcing_strategy = selected_strategy or primary_ecosystem.get("primary_strategy", "Direct Industry Experience")
    strategy_rationale = primary_ecosystem.get("strategy_rationale", "Prioritize headhunting pools with demonstrated functional overlap.")

    # Collate company candidates
    seen_names: Set[str] = set()
    recommended_companies: List[Dict[str, Any]] = []

    active_off_limits = set((name or "").strip().lower() for name in (off_limits_companies or []))
    active_exclusions = set((name or "").strip().lower() for name in (excluded_companies or []))

    # Pull companies strictly from matched ecosystems for role relevance
    source_pools = [primary_ecosystem.get("companies", [])]
    if len(matched_ecosystems) > 1:
        source_pools.append(matched_ecosystems[1].get("companies", []))
    elif not matched_ecosystems:
        source_pools.append(DEFAULT_GENERAL_CATALOG.get("companies", []))

    flat_pool = []
    for pool in source_pools:
        for co in pool:
            c_lower = co["name"].strip().lower()
            if c_lower not in seen_names:
                seen_names.add(c_lower)
                flat_pool.append(co)

    total_pool_count = len(flat_pool)

    for idx, co in enumerate(flat_pool):
        c_name = co["name"]
        c_lower = c_name.strip().lower()

        is_off = c_lower in active_off_limits
        is_excl = c_lower in active_exclusions

        domain_label = domain_meta.get("label", "Target Specialization")
        co_cat = co.get("category", "other")
        tier_level = co.get("tier_level") or ("Tier 1" if co_cat in ["oem", "gcc", "retail"] else ("Tier 2" if co_cat in ["gsi", "big4"] else "Tier 3"))
        tier = co.get("tier", f"{tier_level} Sourcing Pool")

        # Dynamically compute distinct overlap skills and a unique why_recommended sentence
        overlap_skills, dynamic_reason = _compute_dynamic_skills_and_reason(
            co=co,
            job_title=title,
            jd_skills=all_jd_skills,
            domain_label=domain_label,
            company_idx=idx,
            total_cos=total_pool_count,
        )

        confidence = co.get("confidence", "High" if idx < 12 else "Medium")

        recommended_companies.append({
            "name": c_name,
            "category": co_cat,
            "tier": tier,
            "tier_level": tier_level,
            "location": co.get("location", "Pan-India Hubs"),
            "description": co.get("description", ""),
            "recommendation_reason": dynamic_reason,
            "why_recommended": dynamic_reason,
            "overlap_skills": overlap_skills,
            "confidence": confidence,
            "sourcing_strategy": sourcing_strategy,
            "is_off_limits": is_off,
            "is_excluded": is_excl,
            "is_targeted": False,
            "recruiter_status": "Off-Limits" if is_off else ("Excluded" if is_excl else "Available"),
        })

    # Include recruiter custom added companies
    if custom_companies:
        for cust in custom_companies:
            cust_name = cust.get("name", "").strip()
            if cust_name and cust_name.lower() not in seen_names:
                seen_names.add(cust_name.lower())
                cust_skills = all_jd_skills[:4] if all_jd_skills else [f"{domain_label} Competencies"]
                recommended_companies.insert(0, {
                    "name": cust_name,
                    "category": cust.get("category", "custom"),
                    "tier": cust.get("tier", "Recruiter Custom Pool"),
                    "tier_level": "Tier 1",
                    "location": cust.get("location", "Not specified"),
                    "description": cust.get("description", "Custom sourcing target defined by recruiter"),
                    "recommendation_reason": f"Custom company added directly by recruiter for targeted headhunting across {', '.join(cust_skills[:3])}.",
                    "why_recommended": f"Custom company added directly by recruiter for targeted headhunting across {', '.join(cust_skills[:3])}.",
                    "overlap_skills": cust_skills,
                    "confidence": "High",
                    "sourcing_strategy": sourcing_strategy,
                    "is_off_limits": cust_name.lower() in active_off_limits,
                    "is_excluded": cust_name.lower() in active_exclusions,
                    "is_targeted": True,
                    "recruiter_status": "Targeted",
                })

    available_strategies = [
        {"id": "direct_industry", "label": "Direct Industry Experience", "description": "Target direct peers, competitors, and studios in the exact same business sector."},
        {"id": "tier1_competitors", "label": "Tier-1 Competitors & Parallel Ecosystems", "description": "Target leading platform partners, Tier-1 consulting practices, and OEMs."},
        {"id": "similar_job_function", "label": "Similar Job Function", "description": "Target companies with high-performing practitioners performing identical day-to-day operations."},
        {"id": "adjacent_industry", "label": "Adjacent Industry", "description": "Broaden pool to include transferable candidates from parallel domains with compatible methodologies."},
        {"id": "technology_based", "label": "Technology / Tool-Based Sourcing", "description": "Target companies whose tech stack strictly overlaps with mandatory software tools."},
        {"id": "geographic_sourcing", "label": "Geographic Sourcing", "description": "Focus headhunting strictly within the same metropolitan hub to eliminate relocation friction."},
    ]

    return {
        "job_id": job.id,
        "job_title": job.title,
        "ecosystem_name": ecosystem_name,
        "primary_strategy": sourcing_strategy,
        "strategy_rationale": strategy_rationale,
        "available_strategies": available_strategies,
        "total_companies_count": len(recommended_companies),
        "targeted_count": sum(1 for c in recommended_companies if c.get("is_targeted")),
        "excluded_count": len(active_exclusions),
        "off_limits_count": len(active_off_limits),
        "companies": recommended_companies,
    }
