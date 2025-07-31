export const communityNurseHomecareForm = [
  {
    questionnaire: {
      id: "daea1b50-d656-4c43-bbd5-739d468e6404",
      slug: "community-nurse-v5",
      version: "",
      title: "Community Nurse Homecare Form",
      description:
        "A questionnaire to assess patient mobility, symptoms, diagnosis, and other health parameters.",
      status: "active",
      subject_type: "encounter",
      styling_metadata: {},
      questions: [
        {
          id: "team",
          text: "Team",
          type: "text",
          link_id: "1",
          required: false,
        },
        {
          id: "mobility",
          text: "Mobility",
          type: "choice",
          link_id: "3",
          required: false,
          answer_option: [
            {
              value: "Bedbound - Cannot move by self",
            },
            {
              value: "Bedbound - Can turn in bed by self",
            },
            {
              value: "Bedbound - Can sit up only with support in bed",
            },
            {
              value: "Bedbound - Can sit up by self in bed",
            },
            {
              value: "Bedbound - Can stand only with support",
            },
            {
              value: "Homebound - Can walk inside home, with support",
            },
            {
              value:
                "Homebound - Can walk inside home but needs support to go outside",
            },
            {
              value: "Independently Active",
            },
          ],
        },
        {
          id: "symptoms",
          text: "Symptoms",
          type: "structured",
          link_id: "4",
          required: false,
          structured_type: "symptom",
        },
        {
          id: "diagnosis",
          text: "Diagnosis",
          type: "structured",
          link_id: "5",
          required: false,
          structured_type: "diagnosis",
        },
        {
          id: "sleep",
          text: "Sleep",
          type: "choice",
          link_id: "6",
          required: false,
          answer_option: [
            {
              value: "EXCESSIVE",
            },
            {
              value: "SATISFACTORY",
            },
            {
              value: "UNSATISFACTORY",
            },
            {
              value: "NO_SLEEP",
            },
          ],
        },
        {
          id: "bowel",
          text: "Bowel",
          type: "group",
          link_id: "7",
          required: false,
          questions: [
            {
              id: "route",
              text: "Route",
              type: "choice",
              link_id: "7.1",
              required: true,
              answer_option: [
                {
                  value: "ANAL_CANAL",
                },
                {
                  value: "ARTIFICIAL_STOMA",
                },
              ],
            },
            {
              id: "issues",
              text: "Issues",
              type: "choice",
              link_id: "7.2",
              required: true,
              answer_option: [
                {
                  value: "NO_DIFFICULTY",
                },
                {
                  value: "DIFFICULTY_LESS_THAN_2_DAYS",
                },
                {
                  value: "CONSTIPATION",
                },
                {
                  value: "DIARRHEA",
                },
              ],
            },
          ],
        },
        {
          id: "bladder",
          text: "Bladder",
          type: "group",
          link_id: "8",
          required: false,
          questions: [
            {
              id: "drainage_issues",
              text: "Drainage Issues",
              type: "choice",
              link_id: "8.1",
              required: false,
              answer_option: [
                {
                  value: "NO_ISSUES",
                },
                {
                  value: "RETENTION",
                },
                {
                  value: "INCONTINENCE",
                },
              ],
            },
            {
              id: "type_of_drainage",
              text: "Type of Drainage",
              type: "choice",
              link_id: "8.2",
              required: false,
              answer_option: [
                {
                  value: "NORMAL",
                },
                {
                  value: "DIAPER",
                },
                {
                  value: "URINAL/COMMODE",
                },
                {
                  value: "Condom Catheter",
                },
                {
                  value: "Indwelling catheter usage",
                },
                {
                  value: "Urostomy",
                },
              ],
            },
          ],
        },
        {
          id: "nutrition",
          text: "Nutrition",
          type: "group",
          link_id: "33",
          required: false,
          questions: [
            {
              id: "nutrition_route",
              text: "Nutrition Route",
              type: "choice",
              link_id: "4.1",
              required: false,
              answer_option: [
                {
                  value: "ORAL",
                },
                {
                  value: "RYLE'S_TUBE",
                },
                {
                  value: "GASTROSTOMY_OR_JEJUNOSTOMY",
                },
                {
                  value: "PEG",
                },
                {
                  value: "PARENTERAL_TUBING_FLUID",
                },
                {
                  value: "PARENTERAL_TUBING_TPN",
                },
              ],
            },
            {
              id: "appetite",
              text: "Appetite",
              type: "choice",
              link_id: "4.3",
              required: false,
              answer_option: [
                {
                  value: "INCREASED",
                },
                {
                  value: "SATISFACTORY",
                },
                {
                  value: "REDUCED",
                },
                {
                  value: "NO_TASTE_FOR_FOOD",
                },
                {
                  value: "CANNOT_BE_ASSESSED",
                },
              ],
            },
          ],
        },
        {
          id: "vitals",
          text: "Vitals",
          type: "group",
          link_id: "11",
          required: false,
          questions: [
            {
              id: "blood_pressure",
              code: {
                code: "LP40259-1",
                system: "http://loinc.org",
                display: "Blood pressure",
              },
              text: "Blood Pressure",
              type: "group",
              link_id: "11.1",
              questions: [
                {
                  id: "systolic_blood_pressure",
                  code: {
                    code: "8480-6",
                    system: "http://loinc.org",
                    display: "Systolic blood pressure",
                  },
                  text: "Systolic Blood Pressure",
                  type: "decimal",
                  unit: {
                    code: "mm[Hg]",
                    system: "http://unitsofmeasure.org",
                    display: "millimeter of mercury",
                  },
                  link_id: "11.1.1",
                },
                {
                  id: "diastolic_blood_pressure",
                  code: {
                    code: "8462-4",
                    system: "http://loinc.org",
                    display: "Diastolic blood pressure",
                  },
                  text: "Diastolic Blood Pressure",
                  type: "decimal",
                  unit: {
                    code: "mm[Hg]",
                    system: "http://unitsofmeasure.org",
                    display: "millimeter of mercury",
                  },
                  link_id: "11.1.2",
                },
              ],
              styling_metadata: {
                classes: "col-span-all",
                containerClasses: "grid-2-col",
              },
            },
            {
              id: "pulse",
              code: {
                code: "8889-8",
                system: "http://loinc.org",
                display: "Pulse rate",
              },
              text: "Pulse",
              type: "decimal",
              unit: {
                code: "{Beats}/min",
                system: "http://unitsofmeasure.org",
                display: "Beats / minute",
              },
              link_id: "11.2",
            },
            {
              id: "spo2",
              code: {
                code: "59408-5",
                system: "http://loinc.org",
                display: "Oxygen saturation in Arterial blood",
              },
              text: "SpO2",
              type: "decimal",
              unit: {
                code: "%",
                system: "http://unitsofmeasure.org",
                display: "percent",
              },
              link_id: "11.3",
            },
            {
              id: "blood_sugar_level",
              code: {
                code: "2339-0",
                system: "http://loinc.org",
                display: "Blood Glucose",
              },
              text: "Blood Sugar Level",
              type: "decimal",
              unit: {
                code: "mg/dL",
                system: "http://unitsofmeasure.org",
                display: "milligram per deciliter",
              },
              link_id: "11.4",
            },
            {
              id: "pain",
              text: "Pain",
              type: "choice",
              link_id: "11.5",
              answer_option: [
                {
                  value: "NO_PAIN",
                },
                {
                  value: "MILD",
                },
                {
                  value: "MODERATE",
                },
                {
                  value: "SEVERE",
                },
              ],
            },
          ],
          styling_metadata: {
            containerClasses: "grid grid-cols-1",
          },
        },
        {
          id: "ongoing_medication",
          text: "Ongoing Medication",
          type: "structured",
          link_id: "12",
          required: false,
          description:
            "List ongoing medications using FHIR MedicationRequest format.",
          structured_type: "medication_statement",
        },
        {
          id: "nursing_care",
          text: "Nursing Care",
          type: "choice",
          link_id: "16",
          repeats: true,
          required: false,
          answer_option: [
            {
              value: "ORAL_CARE",
            },
            {
              value: "HAIR_CARE",
            },
            {
              value: "BED_BATH",
            },
            {
              value: "EYE_CARE",
            },
            {
              value: "PERINEAL_CARE",
            },
            {
              value: "SKIN_CARE",
            },
            {
              value: "PRE_ENEMA",
            },
            {
              value: "WOUND_DRESSING",
            },
            {
              value: "LYMPHEDEMA_CARE",
            },
            {
              value: "ASCITIC_TAPPING",
            },
            {
              value: "COLOSTOMY_CARE",
            },
            {
              value: "COLOSTOMY_CHANGE",
            },
            {
              value: "OTHER_HYGIENE",
            },
            {
              value: "POSITIONING",
            },
            {
              value: "SUCTIONING",
            },
            {
              value: "RYLES_TUBE_CARE",
            },
            {
              value: "RYLES_TUBE_CHANGE",
            },
            {
              value: "IV_SITE_CARE",
            },
            {
              value: "NEBULISATION",
            },
            {
              value: "DRESSING",
            },
            {
              value: "DVT_PUMP_STOCKING",
            },
            {
              value: "RESTRAIN",
            },
            {
              value: "CHEST_TUBE_CARE",
            },
            {
              value: "TRACHEOSTOMY_CARE",
            },
            {
              value: "TRACHEOSTOMY_TUBE_CHANGE",
            },
            {
              value: "STOMA_CARE",
            },
            {
              value: "CATHETER_CARE",
            },
            {
              value: "CATHETER_CHANGE",
            },
            {
              value: "SHOWER_BATH",
            },
            {
              value: "EAR_CARE",
            },
            {
              value: "NAIL_CARE",
            },
            {
              value: "NASAL_CARE",
            },
            {
              value: "URO_CONDOM_CARE",
            },
            {
              value: "CATHETER_CHECK",
            },
            {
              value: "UROBAG_CHANGE",
            },
            {
              value: "CATHETER_REMOVAL",
            },
            {
              value: "BLADDER_WASH",
            },
            {
              value: "RT_CHECK",
            },
            {
              value: "EXTERNAL_FEEDING",
            },
            {
              value: "ORAL_FEEDING",
            },
            {
              value: "INJECTIONS",
            },
            {
              value: "INFUSIONS",
            },
            {
              value: "IVF_INJECTION_INFERTILITY",
            },
            {
              value: "CANNULA_REMOVAL",
            },
            {
              value: "CANNULA_INSERTION",
            },
            {
              value: "DEATH_CARE",
            },
            {
              value: "DEATH_DECLARATION",
            },
            {
              value: "SUTURING",
            },
            {
              value: "SUTURE_REMOVAL",
            },
          ],
        },
        {
          id: "comfort_assistive_devices",
          text: "Comfort/Assistive Devices",
          type: "choice",
          link_id: "17",
          repeats: true,
          required: false,
          answer_option: [
            {
              value: "HOSPITAL_BED",
            },
            {
              value: "AIR_BED",
            },
            {
              value: "WATER_BED",
            },
            {
              value: "BACKREST",
            },
            {
              value: "SIDE_RAIL",
            },
            {
              value: "AIR_CUSHION",
            },
            {
              value: "GEL_CUSHION",
            },
            {
              value: "CARDIAC_TABLE",
            },
            {
              value: "SAND_BAG",
            },
            {
              value: "CERVICAL_PILLOW",
            },
            {
              value: "HOT_WATER_BAG",
            },
            {
              value: "BED_BLOCK",
            },
            {
              value: "OXYGEN_CYLINDER",
            },
            {
              value: "CONCENTRATOR",
            },
            {
              value: "C_PAP_MACHINE",
            },
            {
              value: "BIPAP_MACHINE",
            },
            {
              value: "OXYGEN_FLOW_METER_WITH_HUMIDIFIER",
            },
            {
              value: "NRBM_MASK",
            },
            {
              value: "NEBULIZER",
            },
            {
              value: "INHALER",
            },
            {
              value: "ROTAHALER",
            },
            {
              value: "SPACER",
            },
            {
              value: "O2_MASK",
            },
            {
              value: "NASAL_CANNULA",
            },
            {
              value: "SPIROMETER",
            },
            {
              value: "HANDHELD_FAN",
            },
            {
              value: "STATIC_COMMODE_CHAIR",
            },
            {
              value: "FOLDING_COMMODE_CHAIR",
            },
            {
              value: "WHEELED_COMMODE_CHAIR",
            },
            {
              value: "HANDLE_DETACHABLE_COMMODE_CHAIR",
            },
            {
              value: "TOILET_FRAME_WITH_SEAT",
            },
            {
              value: "STANDARD_WALKER",
            },
            {
              value: "FOLDING_WALKER",
            },
            {
              value: "TWO_WHEEL_WALKER",
            },
            {
              value: "FOUR_WHEEL_WALKER",
            },
            {
              value: "ELBOW_CRUTCHES",
            },
            {
              value: "AXILLARY_CRUTCHES",
            },
            {
              value: "ADJUSTABLE_WALKING_STICK",
            },
            {
              value: "FOLDING_WALKING_STICK",
            },
            {
              value: "QUAD_CANE",
            },
            {
              value: "TRIPOD_CANE",
            },
            {
              value: "T_HANDLE_WALKING_STICK",
            },
          ],
        },
        {
          id: "care_plan",
          text: "Care Plan",
          type: "group",
          link_id: "15",
          required: true,
          questions: [
            {
              id: "care_plan",
              text: "Care Plan",
              type: "text",
              link_id: "15.1",
              required: true,
              description: "Provide detailed care plan for the patient.",
            },
            {
              id: "frequency_of_follow_up",
              text: "Frequency of Follow-Up Required",
              type: "choice",
              link_id: "15.2",
              required: true,
              answer_option: [
                {
                  value: "CONTINUOUS_CAREGIVER_SUPPORT",
                },
                {
                  value: "8TH_HOURLY_CARE",
                },
                {
                  value: "TWICE_DAILY",
                },
                {
                  value: "DAILY",
                },
                {
                  value: "ALTERNATE_DAYS",
                },
                {
                  value: "TWICE_IN_A_WEEK",
                },
                {
                  value: "WEEKLY",
                },
                {
                  value: "TWO_WEEKLY",
                },
                {
                  value: "MONTHLY",
                },
              ],
            },
            {
              id: "next_visit_on",
              text: "Next Visit On",
              type: "structured",
              link_id: "15.3",
              required: true,
              structured_type: "appointment",
            },
          ],
        },
        {
          id: "visit_duration",
          text: "Visit Duration",
          type: "choice",
          link_id: "22",
          required: false,
          answer_option: [
            {
              value: "LESS_THAN_15_MIN",
            },
            {
              value: "LESS_THAN_30_MIN",
            },
            {
              value: "LESS_THAN_1_HOUR",
            },
            {
              value: "LESS_THAN_1.5_HOURS",
            },
            {
              value: "LESS_THAN_2_HOURS",
            },
            {
              value: "LESS_THAN_2.5_HOURS",
            },
            {
              value: "LESS_THAN_3_HOURS",
            },
            {
              value: "MORE_THAN_3_HOURS",
            },
          ],
        },
        {
          id: "tele_consult",
          text: "Tele Consult",
          type: "group",
          link_id: "21",
          required: false,
          questions: [
            {
              id: "was_teleconsultation_done",
              text: "Was a Teleconsultation Done?",
              type: "choice",
              link_id: "21.1",
              required: true,
              answer_option: [
                {
                  value: "YES",
                },
                {
                  value: "NO",
                },
              ],
            },
          ],
        },
        {
          id: "allergies",
          text: "Allergies",
          type: "structured",
          link_id: "Q-1752137268896",
          read_only: false,
          structured_type: "allergy_intolerance",
        },
      ],
      created_by: {
        meta: {},
        id: "4783b070-323d-42e5-bb9d-eef4f14138b6",
        first_name: "Admin",
        last_name: "User",
        phone_number: "",
        prefix: null,
        suffix: null,
        last_login: "2025-07-11T13:00:12.666909Z",
        profile_picture_url: null,
        user_type: "admin",
        gender: null,
        username: "admin",
        mfa_enabled: false,
        deleted: false,
      },
      updated_by: {
        meta: {},
        id: "4783b070-323d-42e5-bb9d-eef4f14138b6",
        first_name: "Admin",
        last_name: "User",
        phone_number: "",
        prefix: null,
        suffix: null,
        last_login: "2025-07-11T13:00:12.666909Z",
        profile_picture_url: null,
        user_type: "admin",
        gender: null,
        username: "admin",
        mfa_enabled: false,
        deleted: false,
      },
      tags: [],
    },
    responses: [
      {
        question_id: "dee319ba-73e9-4711-a9fb-7c43b4dacebf",
        link_id: "1",
        values: [],
        structured_type: null,
      },
      {
        question_id: "8d989ab7-758a-4955-905c-a8b372febb35",
        link_id: "3",
        values: [],
        structured_type: null,
      },
      {
        question_id: "3158bcee-6682-4aa6-9ad5-9a28f38ffce0",
        link_id: "4",
        values: [
          {
            type: "symptom",
            value: [],
          },
        ],
        structured_type: "symptom",
      },
      {
        question_id: "86437df6-e958-4dc1-8256-75e10ee9daf3",
        link_id: "5",
        values: [
          {
            type: "diagnosis",
            value: [],
          },
        ],
        structured_type: "diagnosis",
      },
      {
        question_id: "42297db6-8f47-4c7a-8951-dc51098b0b67",
        link_id: "6",
        values: [],
        structured_type: null,
      },
      {
        question_id: "c8494811-ada7-4bfd-8602-9172d7a591a2",
        link_id: "7.1",
        values: [],
        structured_type: null,
      },
      {
        question_id: "7281b529-110e-45a7-a23b-c04a0414ae39",
        link_id: "7.2",
        values: [],
        structured_type: null,
      },
      {
        question_id: "1fe58e42-cbf6-4995-8abd-d3e3231a9246",
        link_id: "8.1",
        values: [],
        structured_type: null,
      },
      {
        question_id: "94dd2725-0896-4c9c-af0d-77c136fe17ad",
        link_id: "8.2",
        values: [],
        structured_type: null,
      },
      {
        question_id: "137c40e9-9850-44a3-9f32-fb028ea39112",
        link_id: "8.2.1",
        values: [],
        structured_type: null,
      },
      {
        question_id: "d66adbd3-2df5-4799-a702-6b4c2d21c482",
        link_id: "8.2.3",
        values: [],
        structured_type: null,
      },
      {
        question_id: "6e7b0f67-d295-4030-9322-83fc0def3023",
        link_id: "8.2.4",
        values: [],
        structured_type: null,
      },
      {
        question_id: "4c28bb68-8c60-4a69-8c27-3610c8ff93fc",
        link_id: "8.2.5",
        values: [],
        structured_type: null,
      },
      {
        question_id: "73795da1-c744-492e-81ca-9830c9466206",
        link_id: "8.2.6",
        values: [],
        structured_type: null,
      },
      {
        question_id: "6efb723b-ecd1-41b4-a85b-2fbf9ef6fecc",
        link_id: "4.1",
        values: [],
        structured_type: null,
      },
      {
        question_id: "29cf2040-2419-4592-b7eb-20c9a0b3a2ef",
        link_id: "4.3",
        values: [],
        structured_type: null,
      },
      {
        question_id: "3489b2a9-8936-482a-b167-c2799e7139e5",
        link_id: "11.1.1",
        values: [],
        structured_type: null,
      },
      {
        question_id: "5a66a883-78ed-434c-b310-0916285976df",
        link_id: "11.1.2",
        values: [],
        structured_type: null,
      },
      {
        question_id: "969bd46c-1c3e-4859-93d2-2a74f04e5e66",
        link_id: "11.2",
        values: [],
        structured_type: null,
      },
      {
        question_id: "439451e1-9708-4059-b71a-6113fddc51a0",
        link_id: "11.3",
        values: [],
        structured_type: null,
      },
      {
        question_id: "b2ab1d57-109e-4eb5-bd70-8e4867ef26ba",
        link_id: "11.4",
        values: [],
        structured_type: null,
      },
      {
        question_id: "a05453a1-1e79-4cb7-ab17-6fc82cda0052",
        link_id: "11.5",
        values: [],
        structured_type: null,
      },
      {
        question_id: "0981a515-2791-4016-94e8-dfe94874bbde",
        link_id: "12",
        values: [
          {
            type: "medication_statement",
            value: [],
          },
        ],
        structured_type: "medication_statement",
      },
      {
        question_id: "782df869-5cca-4e78-ae0b-e2b58ce61ca4",
        link_id: "16",
        values: [],
        structured_type: null,
      },
      {
        question_id: "312a5d8a-1b70-4668-98db-24d36bc873d1",
        link_id: "17",
        values: [],
        structured_type: null,
      },
      {
        question_id: "28224e1a-0002-439d-bd78-16857bfaf557",
        link_id: "15.1",
        values: [],
        structured_type: null,
      },
      {
        question_id: "c40c28cb-ccf9-4d48-941b-6f4af4f620a6",
        link_id: "15.2",
        values: [],
        structured_type: null,
      },
      {
        question_id: "c7e4b701-2d58-4ea9-b0eb-e2a2eba40107",
        link_id: "15.3",
        values: [],
        structured_type: "appointment",
      },
      {
        question_id: "b7133cae-156f-4320-a366-1bcb9afad685",
        link_id: "22",
        values: [],
        structured_type: null,
      },
      {
        question_id: "32797827-fd71-4f81-a29e-4d3f2a408d0b",
        link_id: "21.1",
        values: [],
        structured_type: null,
      },
      {
        question_id: "1e6ed747-4e66-438a-88e6-1566f9013e30",
        link_id: "21.2",
        values: [],
        structured_type: null,
      },
      {
        question_id: "c6f75618-1e0f-4d00-b2e6-6c01fe3e5228",
        link_id: "21.3",
        values: [],
        structured_type: null,
      },
      {
        question_id: "b0813892-030c-40da-8039-fe3a906f0634",
        link_id: "21.4",
        values: [],
        structured_type: "medication_request",
      },
      {
        question_id: "9ea5e19b-df9c-46cc-b6d3-5412f0e0ebad",
        link_id: "Q-1752137268896",
        values: [
          {
            type: "allergy_intolerance",
            value: [],
          },
        ],
        structured_type: "allergy_intolerance",
      },
    ],
    errors: [],
  },
] as const;

export const allStructuredTypesForm = [
  {
    questionnaire: {
      id: "26dcd281-7c99-4c26-a9d1-864c9d95e3de",
      slug: "master-questionnair",
      version: "",
      title: "Master Questionnaire",
      description: "",
      status: "active",
      subject_type: "encounter",
      styling_metadata: {},
      questions: [
        {
          id: "date_time_of_encounter",
          text: "the date and time of encounter been recorded",
          type: "dateTime",
          link_id: "Q-1750334193911",
          required: true,
        },
        {
          id: "patient_shows_medication_info",
          text: "Does the patient shows have any medication information",
          type: "boolean",
          link_id: "Q-1750328670426",
        },
        {
          id: "cfb123f3-06b1-4998-9961-43546c900787",
          text: "Medication Diagnosis",
          type: "group",
          link_id: "Q-1750328887909",
          questions: [
            {
              id: "medication_request",
              text: "Medication Prescribed (Request)",
              type: "structured",
              link_id: "Q-1750329455223",
              structured_type: "medication_request",
            },
            {
              id: "medication_history",
              text: "Medication Statement (History)",
              type: "structured",
              link_id: "Q-1750329976033",
              structured_type: "medication_statement",
            },
          ],
          enable_when: [
            {
              answer: "Yes",
              operator: "equals",
              question: "Q-1750328670426",
            },
          ],
        },
        {
          id: "why_patient_doesnt_have_medical_reason",
          text: "Why the patient doesn't have any medical reason",
          type: "string",
          link_id: "Q-1750330258352",
          enable_when: [
            {
              answer: "No",
              operator: "equals",
              question: "Q-1750328670426",
            },
            {
              answer: "Yes",
              operator: "not_equals",
              question: "Q-1750328670426",
            },
          ],
        },
        {
          id: "expected_date_for_medication_history",
          text: "Expected date for the medication history to be filled",
          type: "integer",
          link_id: "Q-1750333368646",
          enable_when: [
            {
              answer: true,
              operator: "exists",
              question: "Q-1750330258352",
            },
          ],
        },
        {
          id: "patient_profession",
          text: "what is the profession of the patient",
          type: "choice",
          link_id: "Q-1750334310662",
          answer_option: [
            {
              value: "Professional",
            },
            {
              value: "Unskilled labour",
            },
            {
              value: "Skilled labour",
            },
            {
              value: "Other",
            },
          ],
        },
        {
          id: "patient_other_profession",
          text: "What is the other profession of the patient",
          type: "choice",
          link_id: "Q-1750334914724",
          enable_when: [
            {
              answer: "Other",
              operator: "equals",
              question: "Q-1750334310662",
            },
          ],
          answer_option: [
            {
              value: "Business Men",
            },
            {
              value: "Entrepreneur",
            },
            {
              value: "Home Maker",
            },
            {
              value: "Retired Person",
            },
            {
              value: "N/A",
            },
          ],
        },
        {
          id: "patient_links",
          text: "Provide Links to patient reports, if any",
          type: "url",
          link_id: "Q-1750333852096",
        },
        {
          id: "patient_bmi_info",
          text: "Patient shared which all information to calculate BMI",
          type: "choice",
          link_id: "Q-1750335431719",
          repeats: true,
          answer_option: [
            {
              value: "Height",
            },
            {
              value: "Weight",
            },
            {
              value: "N/A",
            },
          ],
        },
        {
          id: "next_consultation_date",
          text: "Preferred next consultation date ",
          type: "date",
          link_id: "Q-1750334093849",
          required: true,
        },
        {
          id: "next_consultation_time",
          text: "Preferred next consultation time",
          type: "time",
          link_id: "Q-1750333933325",
          required: true,
        },
        {
          id: "patient_remarks",
          text: "Remarks if any",
          type: "text",
          link_id: "Q-1750335593759",
        },
        {
          id: "patient_rating",
          text: "How did the patient rate the services",
          type: "integer",
          link_id: "Q-1750335635057",
        },
        {
          id: "why_rating_less_than_8",
          text: "Why its rated less or equal to 8",
          type: "text",
          link_id: "Q-1750335681228",
          enable_when: [
            {
              answer: 0,
              operator: "less_or_equals",
              question: "Q-1750335635057",
            },
          ],
        },
        {
          id: "why_rating_greater_than_8",
          text: "Why its rated greater than 8",
          type: "text",
          link_id: "Q-1750335770581",
          enable_when: [
            {
              answer: 8,
              operator: "greater",
              question: "Q-1750335635057",
            },
          ],
        },
        {
          id: "35db4625-6131-4b60-a008-c5e37165cad7",
          text: "Display",
          type: "display",
          link_id: "Q-1750333628672",
          description: "Note: All information is confidential",
        },
        {
          id: "clinical_record",
          text: "Below are the clinical record of the patient",
          type: "text",
          link_id: "Q-1750336197774",
          read_only: true,
        },
        {
          id: "359137dd-dd1e-416c-8dcb-b4f173c6b6f6",
          text: "Structured question of the clinical Record",
          type: "group",
          link_id: "Q-1750337803684",
          questions: [
            {
              id: "allergies",
              text: "Allergies",
              type: "structured",
              link_id: "Q-1750337836896",
              structured_type: "allergy_intolerance",
            },
            {
              id: "symptoms",
              text: "Symptom",
              type: "structured",
              link_id: "Q-1750338077262",
              structured_type: "symptom",
            },
            {
              id: "diagnosis",
              text: "Diagnosis",
              type: "structured",
              link_id: "Q-1750338100618",
              structured_type: "diagnosis",
            },
            {
              id: "encounter",
              text: "Encounter",
              type: "structured",
              link_id: "Q-1750338117891",
              structured_type: "encounter",
            },
            {
              id: "time_of_death",
              text: "Time of death",
              type: "structured",
              link_id: "Q-1750338131186",
              structured_type: "time_of_death",
            },
            {
              id: "appointment",
              text: "Appointment",
              type: "structured",
              link_id: "Q-1750338152209",
              structured_type: "appointment",
            },
            {
              id: "files",
              text: "Files",
              type: "structured",
              link_id: "Q-1750338173626",
              structured_type: "files",
            },
          ],
        },
        {
          id: "patient_temperature",
          text: "what is the patients temperature (Normal 37 degree C)",
          type: "decimal",
          unit: {
            code: "Cel",
            system: "http://unitsofmeasure.org",
            display: "degree Celsius",
          },
          link_id: "Q-1750338220704",
        },
        {
          id: "lower_temperature_reason",
          text: "Reason for lower temperature (  <37 )",
          type: "text",
          link_id: "Q-1750338359523",
          enable_when: [
            {
              answer: 37,
              operator: "less",
              question: "Q-1750338220704",
            },
          ],
        },
        {
          id: "higher_temperature_reason",
          text: "Reason for higher temperature (38)",
          type: "string",
          link_id: "Q-1750338361995",
          enable_when: [
            {
              answer: 38,
              operator: "greater_or_equals",
              question: "Q-1750338220704",
            },
          ],
        },
      ],
      created_by: {
        meta: {},
        id: "4783b070-323d-42e5-bb9d-eef4f14138b6",
        first_name: "Admin",
        last_name: "User",
        phone_number: "",
        prefix: null,
        suffix: null,
        last_login: "2025-07-25T05:57:08.627504Z",
        profile_picture_url: null,
        user_type: "admin",
        gender: null,
        username: "admin",
        mfa_enabled: false,
        deleted: false,
      },
      updated_by: {
        meta: {},
        id: "4783b070-323d-42e5-bb9d-eef4f14138b6",
        first_name: "Admin",
        last_name: "User",
        phone_number: "",
        prefix: null,
        suffix: null,
        last_login: "2025-07-25T05:57:08.627504Z",
        profile_picture_url: null,
        user_type: "admin",
        gender: null,
        username: "admin",
        mfa_enabled: false,
        deleted: false,
      },
      tags: [],
    },
    responses: [
      {
        question_id: "a1fb0706-2a8c-43a8-8781-84cd1ec18620",
        link_id: "Q-1750334193911",
        values: [],
        structured_type: null,
      },
      {
        question_id: "ff2f8bb9-5a84-43e1-9c73-94defb1e75d6",
        link_id: "Q-1750328670426",
        values: [],
        structured_type: null,
      },
      {
        question_id: "d4927f30-9a5d-424e-acfc-3ba184ed56d9",
        link_id: "Q-1750329455223",
        values: [],
        structured_type: "medication_request",
      },
      {
        question_id: "870129bd-1e65-43dd-8bfc-4b5c3a6aeeed",
        link_id: "Q-1750329976033",
        values: [],
        structured_type: "medication_statement",
      },
      {
        question_id: "2ffe209a-b3a1-48ce-b08d-ab0ae9820e35",
        link_id: "Q-1750330258352",
        values: [],
        structured_type: null,
      },
      {
        question_id: "d5552a9f-a224-495d-bb76-7098709ffcde",
        link_id: "Q-1750333368646",
        values: [],
        structured_type: null,
      },
      {
        question_id: "f58e00cf-33fa-4352-bb1c-d1979d49c09d",
        link_id: "Q-1750334310662",
        values: [],
        structured_type: null,
      },
      {
        question_id: "75e17a60-4dd9-4ceb-8e6a-d361392ed17c",
        link_id: "Q-1750334914724",
        values: [],
        structured_type: null,
      },
      {
        question_id: "50328d1d-9578-464d-83ed-b508ad3e6bbc",
        link_id: "Q-1750333852096",
        values: [],
        structured_type: null,
      },
      {
        question_id: "68417408-51ab-4cc5-a7af-773fdec51b5d",
        link_id: "Q-1750335431719",
        values: [],
        structured_type: null,
      },
      {
        question_id: "57f71c23-134c-4ee6-b8ca-b1dd218b4683",
        link_id: "Q-1750334093849",
        values: [],
        structured_type: null,
      },
      {
        question_id: "ae8152ae-eb08-4257-979e-0ba163400111",
        link_id: "Q-1750333933325",
        values: [],
        structured_type: null,
      },
      {
        question_id: "38279cd4-d536-4e01-ad65-ae540b34035e",
        link_id: "Q-1750335593759",
        values: [],
        structured_type: null,
      },
      {
        question_id: "24ee3ea7-c39d-4405-864e-984b258ae87a",
        link_id: "Q-1750335635057",
        values: [],
        structured_type: null,
      },
      {
        question_id: "0b05dcaa-a505-439c-83c9-bbccdf310f70",
        link_id: "Q-1750335681228",
        values: [],
        structured_type: null,
      },
      {
        question_id: "ff30e077-0c92-496c-b490-bf6502e05dbb",
        link_id: "Q-1750335770581",
        values: [],
        structured_type: null,
      },
      {
        question_id: "35db4625-6131-4b60-a008-c5e37165cad7",
        link_id: "Q-1750333628672",
        values: [],
        structured_type: null,
      },
      {
        question_id: "db7e25dd-e68d-477f-b246-d6eea41cc000",
        link_id: "Q-1750336197774",
        values: [],
        structured_type: null,
      },
      {
        question_id: "97134d75-c17f-44bc-9854-e675456aa6a4",
        link_id: "Q-1750337836896",
        values: [
          {
            type: "allergy_intolerance",
            value: [],
          },
        ],
        structured_type: "allergy_intolerance",
      },
      {
        question_id: "5d6aa1b2-116c-41ae-9cee-1cd4db42e1d6",
        link_id: "Q-1750338077262",
        values: [
          {
            type: "symptom",
            value: [],
          },
        ],
        structured_type: "symptom",
      },
      {
        question_id: "96ed9436-6ff4-4e35-b188-f3b1ef2a8704",
        link_id: "Q-1750338100618",
        values: [
          {
            type: "diagnosis",
            value: [],
          },
        ],
        structured_type: "diagnosis",
      },
      {
        question_id: "514c3a2a-222a-415c-877d-7cc8ffbc20a6",
        link_id: "Q-1750338117891",
        values: [
          {
            type: "encounter",
            value: [
              {
                status: "in_progress",
                encounter_class: "hh",
                period: {},
                priority: "rush_reporting",
                external_identifier: null,
                hospitalization: {},
                facility: {
                  id: "202046a6-96b7-4ed5-97cd-be1bc5901eb6",
                  name: "Bawa, Kunda and Soman",
                },
                patient: "d510c2bb-0762-4ec7-ba22-823be4cc0933",
                organizations: [],
                permissions: [
                  "can_create_encounter",
                  "can_list_encounter",
                  "can_write_encounter",
                  "can_read_encounter",
                  "can_submit_encounter_questionnaire",
                  "can_create_patient",
                  "can_write_patient",
                  "can_submit_patient_questionnaire",
                  "can_list_patients",
                  "can_view_clinical_data",
                  "can_view_questionnaire_responses",
                ],
                id: "feb8bc6c-c344-4dfe-b333-f3c790c4a635",
                discharge_summary_advice:
                  "Quibusdam sed sapiente ad velit minus.",
                status_history: {
                  history: [
                    {
                      status: "in_progress",
                      moved_at: "2025-07-01 21:15:52.525820+00:00",
                    },
                  ],
                },
                encounter_class_history: {
                  history: [
                    {
                      status: "hh",
                      moved_at: "2025-07-01 21:15:52.525823+00:00",
                    },
                  ],
                },
                created_date: "2025-07-01T21:15:52.526069Z",
                modified_date: "2025-07-01T21:15:52.526073Z",
                tags: [],
                appointment: {},
                created_by: {
                  meta: {},
                  id: "4783b070-323d-42e5-bb9d-eef4f14138b6",
                  first_name: "Admin",
                  last_name: "User",
                  phone_number: "",
                  prefix: null,
                  suffix: null,
                  last_login: "2025-07-25T05:57:08.627504Z",
                  profile_picture_url: null,
                  user_type: "admin",
                  gender: null,
                  username: "admin",
                  mfa_enabled: false,
                  deleted: false,
                },
                updated_by: {
                  meta: {},
                  id: "4783b070-323d-42e5-bb9d-eef4f14138b6",
                  first_name: "Admin",
                  last_name: "User",
                  phone_number: "",
                  prefix: null,
                  suffix: null,
                  last_login: "2025-07-25T05:57:08.627504Z",
                  profile_picture_url: null,
                  user_type: "admin",
                  gender: null,
                  username: "admin",
                  mfa_enabled: false,
                  deleted: false,
                },
                current_location: null,
                location_history: [],
                care_team: [],
              },
            ],
          },
        ],
        structured_type: "encounter",
      },
      {
        question_id: "e031bf23-96fd-49ef-9401-135a0132b01f",
        link_id: "Q-1750338131186",
        values: [],
        structured_type: "time_of_death",
      },
      {
        question_id: "f62e5576-e280-444c-a4ba-34688f62eb6f",
        link_id: "Q-1750338152209",
        values: [],
        structured_type: "appointment",
      },
      {
        question_id: "e89d7452-7e6d-4c1e-b99e-c2907201855d",
        link_id: "Q-1750338173626",
        values: [
          {
            type: "files",
            value: [],
          },
        ],
        structured_type: "files",
      },
      {
        question_id: "ca89ef3c-4dcb-4884-9a82-3b01470a275d",
        link_id: "Q-1750338220704",
        values: [],
        structured_type: null,
      },
      {
        question_id: "5a4397c1-5dd4-48da-9374-2962bc230bc6",
        link_id: "Q-1750338359523",
        values: [],
        structured_type: null,
      },
      {
        question_id: "c6231df1-49fd-4f51-96e8-1625781c7b5b",
        link_id: "Q-1750338361995",
        values: [],
        structured_type: null,
      },
    ],
    errors: [],
  },
];

export const BENCHMARK_AUDIOS = {
  "Line by Line Dictation": {
    path: "https://maalgaadi.kacker.net/cmd046aoqmkfvrz0blp6c5byf",
    type: "webm",
    form: communityNurseHomecareForm,
    formFill: {
      team: {
        value: "Mr. Shivank",
      },
      mobility: {
        value: "Bedbound - Cannot move by self",
      },
      symptoms: {
        value: [
          {
            code: {
              system: "http://snomed.info/sct",
              code: "386661006",
              display: "Fever",
            },
            clinical_status: "active",
            verification_status: "confirmed",
            severity: "moderate",
            onset: {
              onset_datetime: "2025-07-12T15:43:41.220714",
            },
            category: "problem_list_item",
          },
          {
            code: {
              system: "http://snomed.info/sct",
              code: "49727002",
              display: "Cough",
            },
            clinical_status: "active",
            verification_status: "confirmed",
            severity: "moderate",
            onset: {
              onset_datetime: "2025-07-12T15:43:41.220714",
            },
            category: "problem_list_item",
          },
          {
            code: {
              code: "161891005",
              display: "Backache",
              system: "http://snomed.info/sct",
            },
            clinical_status: "active",
            verification_status: "confirmed",
            severity: "moderate",
            category: "problem_list_item",
            onset: {
              onset_datetime: "2025-07-12",
            },
          },
        ],
      },
      diagnosis: {
        value: [
          {
            code: {
              system: "http://snomed.info/sct",
              code: "73211009",
              display: "Diabetes mellitus",
            },
            clinical_status: "active",
            verification_status: "confirmed",
            onset: {
              onset_datetime: "2025-07-12T16:11:15.661415",
            },
            recorded_date: "2025-07-12T10:47:20.876Z",
            category: "chronic_condition",
          },
        ],
      },
      sleep: {
        value: "SATISFACTORY",
      },
      route: {
        value: "ANAL_CANAL",
      },
      issues: {
        value: "NO_DIFFICULTY",
      },
      drainage_issues: {
        value: "NO_ISSUES",
      },
      type_of_drainage: {
        value: "NORMAL",
      },
      nutrition_route: {
        value: "ORAL",
      },
      appetite: {
        value: "CANNOT_BE_ASSESSED",
      },
      systolic_blood_pressure: {
        value: 90,
      },
      diastolic_blood_pressure: {
        value: 80,
      },
      pulse: {
        value: 52,
      },
      spo2: {
        value: 100,
      },
      blood_sugar_level: {
        value: 300,
      },
      pain: { value: "MODERATE" },
      ongoing_medication: {
        value: [
          {
            status: "active",
            reason: "Fever",
            medication: {
              code: "322236009",
              display: "Paracetamol 500 mg oral tablet",
              system: "http://snomed.info/sct",
            },
            dosage_text: "Take every day",
            effective_period: {
              end: "2025-07-11T18:30:00.000Z",
              start: "2025-06-27T18:30:00.000Z",
            },
            information_source: "patient",
          },
        ],
      },
      nursing_care: {
        value: ["ORAL_CARE", "HAIR_CARE", "BED_BATH"],
      },
      comfort_assistive_devices: {
        value: ["SIDE_RAIL", "WATER_BED", "AIR_BED"],
      },
      care_plan: {
        value:
          "plan to shift the patient to a facility and make sure that their fever is reduced",
      },
      frequency_of_follow_up: {
        value: "MONTHLY",
      },
      visit_duration: {
        value: "LESS_THAN_1_HOUR",
      },
      was_teleconsultation_done: {
        value: "NO",
      },
      allergies: {
        value: [
          {
            code: {
              system: "http://snomed.info/sct",
              code: "102260001",
              display: "Peanut butter",
            },
            clinical_status: "active",
            category: "food",
            criticality: "low",
            verification_status: "confirmed",
          },
          {
            code: {
              system: "http://snomed.info/sct",
              code: "50070141000188102",
              display: "Isomaltose",
            },
            clinical_status: "active",
            category: "food",
            criticality: "low",
            verification_status: "confirmed",
          },
        ],
      },
    },
  },
  "Clinically Viable Dictation": {
    path: "https://maalgaadi.kacker.net/cmd2tt56bmwinrz0bi43tv8nr",
    type: "webm",
    form: communityNurseHomecareForm,
    formFill: {
      team: {
        value: "Green Leaf Palliative Team",
      },
      mobility: {
        value: "Homebound - Can walk inside home, with support",
      },
      symptoms: {
        value: [
          {
            code: {
              code: "267036007",
              display: "Dyspnoea",
              system: "http://snomed.info/sct",
            },
            clinical_status: "active",
            verification_status: "confirmed",
            severity: "moderate",
            category: "problem_list_item",
            onset: {
              onset_datetime: "2025-07-11",
            },
            note: "Breathlessness worse on exertion",
          },
          {
            code: {
              code: "26237000",
              display: "Ankle oedema",
              system: "http://snomed.info/sct",
            },
            clinical_status: "active",
            verification_status: "confirmed",
            severity: "moderate",
            category: "problem_list_item",
            onset: {
              onset_datetime: "2025-07-07",
            },
            note: "Both ankles swollen",
          },
          {
            code: {
              code: "29857009",
              display: "Chest pain",
              system: "http://snomed.info/sct",
            },
            clinical_status: "active",
            verification_status: "confirmed",
            severity: "moderate",
            category: "problem_list_item",
            onset: {
              onset_datetime: "2025-07-13",
            },
            note: "Intermittent dull ache, non-radiating",
          },
          {
            code: {
              code: "14760008",
              display: "Constipation",
              system: "http://snomed.info/sct",
            },
            clinical_status: "active",
            verification_status: "confirmed",
            severity: "moderate",
            category: "problem_list_item",
            onset: {
              onset_datetime: "2025-07-14",
            },
            note: "Has not opened bowels for two days",
          },
        ],
      },
      sleep: {
        value: "UNSATISFACTORY",
      },
      diagnosis: {
        value: [
          {
            code: {
              code: "13645005",
              display: "Chronic obstructive pulmonary disease",
              system: "http://snomed.info/sct",
            },
            clinical_status: "active",
            verification_status: "confirmed",
            category: "encounter_diagnosis",
            onset: {
              onset_datetime: "2018-01-15",
            },
          },
          {
            code: {
              code: "59621000",
              display: "Essential hypertension",
              system: "http://snomed.info/sct",
            },
            clinical_status: "active",
            verification_status: "confirmed",
            category: "encounter_diagnosis",
            onset: {
              onset_datetime: "2024-07-01",
            },
          },
          {
            code: {
              code: "44054006",
              display: "Type 2 diabetes mellitus",
              system: "http://snomed.info/sct",
            },
            clinical_status: "active",
            verification_status: "confirmed",
            category: "encounter_diagnosis",
            onset: {
              onset_datetime: "2023-01-01",
            },
          },
        ],
      },
      ongoing_medication: {
        value: [
          {
            status: "active",
            reason: "Dyspnoea relief (COPD)",
            medication: {
              code: "770300007",
              display:
                "Salbutamol (as salbutamol sulfate) 100 microgram/actuation pressurised suspension for inhalation",
              system: "http://snomed.info/sct",
            },
            dosage_text: "2 puffs when needed, maximum 6 times per day",
            effective_period: {
              start: "2025-01-31T18:30:00.000Z",
              end: "2025-06-30T18:30:00.000Z",
            },
            information_source: "patient",
            note: "",
          },
          {
            status: "active",
            reason: "Maintenance therapy for COPD",
            medication: {
              code: "785983008",
              display:
                "Tiotropium (as tiotropium bromide) 18 microgram/actuation powder for inhalation",
              system: "http://snomed.info/sct",
            },
            dosage_text: "1 capsule via HandiHaler every morning",
            effective_period: {
              start: "2025-01-31T18:30:00.000Z",
              end: "2025-06-30T18:30:00.000Z",
            },
            information_source: "patient",
          },
          {
            status: "active",
            reason: "Type 2 diabetes mellitus",
            medication: {
              code: "325278007",
              display: "Metformin hydrochloride 500 mg oral tablet",
              system: "http://snomed.info/sct",
            },
            dosage_text: "1 tablet after breakfast and dinner",
            effective_period: {
              start: "2022-12-31T18:30:00.000Z",
              end: "2025-06-30T18:30:00.000Z",
            },
            information_source: "patient",
          },
          {
            status: "active",
            reason: "Essential hypertension",
            medication: {
              code: "318956006",
              display: "Losartan potassium 50 mg oral tablet",
              system: "http://snomed.info/sct",
            },
            dosage_text: "1 tablet every morning",
            effective_period: {
              start: "2024-06-30T18:30:00.000Z",
              end: "2025-06-30T18:30:00.000Z",
            },
            information_source: "patient",
          },
          {
            status: "active",
            reason: "Peripheral oedema / fluid overload",
            medication: {
              code: "317972000",
              display: "Furosemide 40 mg oral tablet",
              system: "http://snomed.info/sct",
            },
            dosage_text:
              "1 tablet on alternate mornings (increase to daily × 3 days per plan)",
            effective_period: {
              start: "2025-06-30T18:30:00.000Z",
              end: "2025-06-30T18:30:00.000Z",
            },
            information_source: "patient",
          },
          {
            status: "active",
            reason: "Chest discomfort & myalgia",
            medication: {
              code: "370151002",
              display: "Paracetamol 650 mg oral tablet",
              system: "http://snomed.info/sct",
            },
            dosage_text: "1 tablet three times a day",
            effective_period: {
              start: "2025-07-11T18:30:00.000Z",
              end: "2025-06-30T18:30:00.000Z",
            },
            information_source: "patient",
          },
        ],
      },
      route: {
        value: "ANAL_CANAL",
      },
      nursing_care: {
        value: [
          "NEBULISATION",
          "BED_BATH",
          "HAIR_CARE",
          "ORAL_CARE",
          "WOUND_DRESSING",
          "POSITIONING",
        ],
      },
      pain: {
        value: "MILD",
      },
      spo2: {
        value: 92,
      },
      issues: {
        value: "CONSTIPATION",
      },
      pulse: {
        value: 98,
      },
      appetite: {
        value: "REDUCED",
      },
      care_plan: {
        value:
          "Start Furosemide daily for the next three weeks, then reassess the swelling. Schedule an echocardiogram within two weeks to look at heart function. Refer to a dietitian for a high protein, low salt, diabetic meal plan, and encourage him to drink at least 1.5 liters of fluids every day. Keep a daily log of blood pressure, pulse, and oxygen levels. If resting stats stay below 90%, consider long-term oxygen therapy.",
      },
      drainage_issues: {
        value: "RETENTION",
      },
      comfort_assistive_devices: {
        value: ["HOSPITAL_BED", "SIDE_RAIL", "STANDARD_WALKER", "AIR_CUSHION"],
      },
      type_of_drainage: {
        value: "URINAL/COMMODE",
      },
      blood_sugar_level: {
        value: 180,
      },
      nutrition_route: {
        value: "ORAL",
      },
      frequency_of_follow_up: {
        value: "WEEKLY",
      },
      was_teleconsultation_done: {
        value: "NO",
      },
      systolic_blood_pressure: {
        value: 160,
      },
      diastolic_blood_pressure: {
        value: 95,
      },
      allergies: {
        value: [
          {
            code: {
              code: "764146007",
              display: "Penicillin",
              system: "http://snomed.info/sct",
            },
            clinical_status: "active",
            verification_status: "confirmed",
            category: "medication",
            criticality: "low",
            note: "Generalised maculopapular rash",
            last_occurrence: "2018-06-15",
          },
          {
            code: {
              code: "1003754000",
              display: "Natural rubber latex",
              system: "http://snomed.info/sct",
            },
            clinical_status: "active",
            verification_status: "confirmed",
            category: "environment",
            criticality: "low",
            last_occurrence: "2022-04-10",
            note: "Contact dermatitis from gloves",
          },
        ],
      },
    },
  },
  "Long Dictation": {
    path: "https://maalgaadi.kacker.net/cmdih9n7op18trz0b1x8f11cp",
    type: "webm",
    form: allStructuredTypesForm,
    formFill: {
      date_time_of_encounter: {
        value: "2025-07-24T10:30:00",
      },
      patient_shows_medication_info: {
        value: true,
      },
      medication_request: {
        value: [
          {
            medication: {
              system: "http://snomed.info/sct",
              code: "323510009",
              display: "Amoxicillin 500 mg oral capsule",
            },
            intent: "order",
            status: "active",
            category: "outpatient",
            priority: "urgent",
            do_not_perform: false,
            authored_on: "2025-07-23T23:30:00.000Z",
            dosage_instruction: [
              {
                additional_instruction: [],
                timing: {
                  repeat: {
                    frequency: 3,
                    period: 1,
                    period_unit: "d",
                    bounds_duration: {
                      value: 1,
                      unit: "d",
                    },
                  },
                  code: {
                    code: "TID",
                    display: "Three times a day",
                    system:
                      "http://terminology.hl7.org/CodeSystem/v3-GTSAbbreviation",
                  },
                },
                as_needed_boolean: false,
                route: {
                  system: "http://snomed.info/sct",
                  code: "26643006",
                  display: "Oral route",
                },
                method: {
                  system: "http://snomed.info/sct",
                  code: "738995006",
                  display: "Swallow",
                },
                dose_and_rate: {
                  type: "ordered",
                  dose_quantity: {
                    value: 1,
                    unit: {
                      code: "{tbl}",
                      display: "Tablets",
                      system: "http://unitsofmeasure.org",
                    },
                  },
                },
              },
            ],
          },
        ],
      },
      medication_history: {
        value: [
          {
            medication: {
              system: "http://snomed.info/sct",
              code: "370151002",
              display: "Paracetamol 650 mg oral tablet",
            },
            status: "active",
            dosage_text: "One tablet daily",
            information_source: "patient",
            note: "No adverse effects during this course",
            reason: "Fever",
            effective_period: {
              start: "2025-07-20T00:00:00Z",
              end: "2025-07-22T18:30:00.000Z",
            },
          },
        ],
      },
      why_patient_doesnt_have_medical_reason: {
        value: null,
      },
      expected_date_for_medication_history: {
        value: null,
      },
      patient_profession: {
        value: "Skilled labour",
      },
      patient_other_profession: {
        value: null,
      },
      patient_links: {
        value: null,
      },
      patient_bmi_info: {
        value: ["Height", "Weight"],
      },
      next_consultation_date: {
        value: "2025-07-30",
      },
      next_consultation_time: {
        value: "16:00",
      },
      patient_remarks: {
        value: null,
      },
      patient_rating: {
        value: 9,
      },
      why_rating_less_than_8: {
        value: null,
      },
      why_rating_greater_than_8: {
        value:
          "Healthcare provider was attentive, explained the condition clearly, and provided appropriate medication and advice.",
      },
      clinical_record: {
        value: null,
      },
      allergies: {
        value: [
          {
            code: {
              system: "http://snomed.info/sct",
              code: "764146007",
              display: "Penicillin",
            },
            clinical_status: "resolved",
            category: "medication",
            criticality: "high",
            verification_status: "confirmed",
            last_occurrence: "2020-03-11T18:30:00.000Z",
            note: "Patient experienced a rash and shortness of breath following administration of Penicillin.",
          },
        ],
      },
      symptoms: {
        value: [
          {
            code: {
              system: "http://snomed.info/sct",
              code: "386661006",
              display: "Fever",
            },
            clinical_status: "active",
            verification_status: "confirmed",
            severity: "mild",
            onset: {
              onset_datetime: "2025-07-21T18:30:00.000Z",
            },
            category: "problem_list_item",
          },
          {
            code: {
              system: "http://snomed.info/sct",
              code: "49727002",
              display: "Cough",
            },
            clinical_status: "active",
            verification_status: "confirmed",
            severity: "moderate",
            onset: {
              onset_datetime: "2025-07-21T18:30:00.000Z",
            },
            category: "problem_list_item",
          },
        ],
      },
      diagnosis: {
        value: [
          {
            code: {
              code: "54150009",
              display: "Upper respiratory infection",
              system: "http://snomed.info/sct",
            },
            clinical_status: "active",
            verification_status: "confirmed",
            onset: {
              onset_datetime: "2025-07-21T18:30:00.000Z",
            },
            recorded_date: "2025-07-24T10:30:00.000Z",
            category: "biologic",
            note: "Diagnosis made based on symptoms of fever and cough; suspected viral etiology.",
          },
        ],
      },
      encounter: {
        value: [
          {
            status: "completed",
            encounter_class: "amb",
            priority: "urgent",
          },
        ],
      },
      time_of_death: {
        value: null,
      },
      patient_temperature: {
        value: 38.2,
        note: "Attributed to the suspected viral infection",
      },
      lower_temperature_reason: {
        value: null,
      },
      higher_temperature_reason: {
        value: null,
      },
    },
  },
} as const;

export const BENCHMARK_MODELS = [
  "openai/gpt-4.1",
  "openai/gpt-4o",
  "google/gemini-2.0-flash",
  "google/gemini-2.0-flash-lite",
  "google/gemini-2.5-flash-lite",
  "google/gemini-2.5-flash",
  "google/gemini-2.5-pro",
] as const;
