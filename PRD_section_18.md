# TERRAFORM PRD — Section 18 (mandatory, system-wide)

## 18. Knowledge Base–Driven Architecture

**Core requirement:** All diagnostic results, soil classifications, remediation recommendations, crop information, timelines, planting instructions, ongoing-care procedures, and harvest guidance must originate from a structured, curated Knowledge Base (KB). This requirement applies to every stage (Steps 01–09) of the workflow.

The AI must not independently invent agricultural facts, treatment quantities, crop properties, rules, or recommendations. It must retrieve relevant information from the KB and generate responses grounded in the retrieved records.

### 18.1 Knowledge Base as the Single Source of Truth
The KB must contain:
- Soil archetypes and classification criteria.
- Soil characteristics and deficiency definitions.
- Diagnostic rules and evidence mappings.
- Environmental stressors and their interactions.
- Soil remediation procedures.
- Amendment quantities and application methods.
- Readiness criteria and verification procedures.
- Crop catalog and suitability constraints.
- Crop growth durations and environmental requirements.
- Planting methods and establishment requirements.
- Fertilization and irrigation schedules.
- Pest and disease information.
- Preventive and corrective measures.
- Harvest criteria and maturity indicators.
- Rule dependencies and safety restrictions.
- Source references, units, and validity conditions for recommendations.

Every output must be traceable to one or more KB records.

### 18.2 Knowledge Base Retrieval Pipeline
1. **Input collection:** Receive the user's text, image, and optional environmental parameters.
2. **Feature extraction:** Extract observable characteristics from the supplied inputs.
3. **KB retrieval:** Search for relevant soil profiles, diagnostic rules, environmental conditions, and remediation records.
4. **Rule evaluation:** Match the extracted evidence against the retrieved rules.
5. **Evidence validation:** Determine whether the available evidence satisfies the required conditions for a conclusion.
6. **Recommendation retrieval:** Retrieve supported remediation procedures and readiness requirements.
7. **Crop filtering:** Retrieve and filter crop records using the diagnosed conditions and applicable constraints.
8. **Workflow generation:** Retrieve crop-specific timeframe, planting, care, and harvest records.
9. **Response validation:** Verify that every factual recommendation is supported by KB data.
10. **Output generation:** Display the results with their supporting evidence, sources, and any unresolved information.

### 18.3 Mandatory Rule for Missing Information
If the KB does not contain sufficient information to answer a question, the system must not fabricate an answer. Instead, it must:
- Display an explicit message indicating that sufficient KB information is unavailable.
- Identify the missing data or rule.
- Request additional user input or measurements when necessary.
- Offer only those alternative recommendations that are supported by existing records.
- Allow authorized administrators to add or update the missing KB information.

Example: if the KB has no verified amendment rate for a particular soil treatment, the system must not generate an arbitrary quantity.

### 18.4 Knowledge Base–Driven Crop Selection
Crop selection must be performed using structured crop records and eligibility rules. Each crop record contains:

| Field | Description |
|---|---|
| Crop ID | Unique identifier |
| Crop name | Common name and scientific name, if available |
| Soil compatibility | Supported soil archetypes |
| Stress tolerance | Drought, salinity, waterlogging, heat, and other documented tolerances |
| Water requirement | KB value and units |
| Light requirement | Supported light conditions |
| Growing duration | Verified duration or documented range |
| Soil prerequisites | Required remediation and readiness conditions |
| Planting protocol | Supported sowing or transplanting instructions |
| Care protocol | Irrigation, nutrition, pest, and disease guidance |
| Harvest protocol | Maturity indicators and harvest requirements |
| Source reference | Origin of the crop information |
| Validation status | Approved, pending review, or deprecated |

Only approved records that satisfy the applicable eligibility rules may be presented as verified recommendations.

### 18.5 Knowledge Base–Driven Remediation
Each remediation recommendation must be retrieved from a structured procedure record containing: procedure ID; applicable soil archetypes; target deficiency or environmental problem; required prerequisites; materials and amendments; supported application quantities and units; application procedure; relevant safety restrictions; expected verification criteria; stabilization requirements; source reference; validation status.

The system may calculate quantities from verified KB rates and user-provided plot dimensions. It must not invent rates, extrapolate beyond supported conditions, or treat an unverified calculation as an approved recommendation.

### 18.6 Knowledge Base–Driven Readiness Gate
Readiness decisions must use configurable, version-controlled criteria stored in the KB. The system retrieves the applicable criteria for the diagnosed condition, evaluates the available observations or measurements, and returns one of:
- **NOT READY:** Mandatory conditions are unmet.
- **CONDITIONALLY READY:** Additional verification or corrective action is required.
- **READY:** All applicable mandatory criteria are satisfied.

If a required criterion or measurement is missing, the system must not assume that the criterion has passed.

### 18.7 Knowledge Base Management
Authorized administrators must be able to:
- Add, edit, and deactivate KB records.
- Maintain soil archetypes and diagnostic rules.
- Add crop profiles and remediation procedures.
- Update quantities, units, constraints, and source references.
- Validate and approve new records.
- Maintain version history.
- Track which recommendations depend on each record.
- Roll back incorrect updates.
- Test rule changes against the five reference scenarios and unseen variations.

Unapproved KB changes must not silently become active production recommendations.

### 18.8 AI Responsibilities and Restrictions
The AI is responsible for: interpreting user inputs; extracting observations from images and descriptions; retrieving relevant KB records; matching observations to documented rules; explaining supported conclusions; organizing retrieved information into a coherent workflow; identifying missing evidence and conflicting records.

The AI is not the source of agricultural facts. The KB is the authoritative source. The AI must not:
- Invent soil properties or laboratory measurements.
- Generate unsupported crop recommendations.
- Create undocumented treatment quantities.
- Override mandatory readiness rules.
- Bypass crop eligibility constraints.
- Invent timelines when the KB does not support them.
- Present a model-generated assumption as a verified fact.

### 18.9 Traceability and Auditing
Every generated result must retain: input session ID; relevant KB record IDs; matched rule IDs; KB version; supporting observations; applied eligibility and readiness rules; calculations performed using retrieved values; selected crop; generated recommendations; missing-data warnings; timestamp and model version.

### 18.10 Final Acceptance Criteria
The KB architecture is complete only when:
1. All agricultural facts and recommendations are retrieved from approved KB records.
2. All five case-study categories are represented in the KB.
3. Mixed and unseen cases can be evaluated through generalizable, documented rules.
4. Every diagnosis and recommendation has traceable supporting records.
5. Unsupported information results in an explicit missing-data response rather than fabricated content.
6. Crop selection and downstream guidance update dynamically using KB records.
7. Readiness gates cannot be bypassed by AI-generated text.
8. Administrators can maintain, validate, version, and audit the KB.
9. Automated tests verify that unsupported recommendations are rejected.
10. No unverified AI-generated agricultural fact is presented as an authoritative recommendation.

**Architecture principle:** The AI interprets the evidence; the Knowledge Base supplies the facts; the rule engine determines eligibility; and the application orchestrates the workflow.
