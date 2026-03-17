-- Split ca_score (/40) into ca1_score (/20) + ca2_score (/20)
-- ca_score and total become generated columns

-- Step 1: Add new columns
ALTER TABLE subject_scores ADD COLUMN IF NOT EXISTS ca1_score NUMERIC(5,2) DEFAULT 0;
ALTER TABLE subject_scores ADD COLUMN IF NOT EXISTS ca2_score NUMERIC(5,2) DEFAULT 0;

-- Step 2: Migrate existing data from ca_score into ca1/ca2
UPDATE subject_scores
SET ca1_score = LEAST(ca_score, 20),
    ca2_score = LEAST(GREATEST(ca_score - 20, 0), 20);

-- Step 3: Drop generated 'total' column (depends on ca_score)
ALTER TABLE subject_scores DROP COLUMN IF EXISTS total;

-- Step 4: Drop old ca_score column
ALTER TABLE subject_scores DROP COLUMN IF EXISTS ca_score;

-- Step 5: Re-add ca_score as generated (ca1 + ca2)
ALTER TABLE subject_scores ADD COLUMN ca_score NUMERIC(5,2) GENERATED ALWAYS AS (ca1_score + ca2_score) STORED;

-- Step 6: Re-add total as generated (ca1 + ca2 + exam)
ALTER TABLE subject_scores ADD COLUMN total NUMERIC(5,2) GENERATED ALWAYS AS (ca1_score + ca2_score + exam_score) STORED;

-- Step 7: Add check constraints
ALTER TABLE subject_scores ADD CONSTRAINT ca1_score_range CHECK (ca1_score >= 0 AND ca1_score <= 20);
ALTER TABLE subject_scores ADD CONSTRAINT ca2_score_range CHECK (ca2_score >= 0 AND ca2_score <= 20);
