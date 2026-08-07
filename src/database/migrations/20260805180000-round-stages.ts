import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface): Promise<void> {
	await queryInterface.createTable('round_stages', {
		id: { type: DataTypes.BIGINT, autoIncrement: true, primaryKey: true },
		round_id: {
			type: DataTypes.BIGINT,
			allowNull: false,
			references: { model: 'review_rounds', key: 'id' },
			onUpdate: 'CASCADE',
			onDelete: 'CASCADE',
		},
		code: { type: DataTypes.STRING(40), allowNull: false },
		name: { type: DataTypes.STRING(100), allowNull: false },
		description: { type: DataTypes.TEXT, allowNull: false, defaultValue: '' },
		sort_order: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
		/** assessment = rate students; intervention = questions/actions; summary = review impact */
		stage_type: {
			type: DataTypes.ENUM('assessment', 'intervention', 'summary'),
			allowNull: false,
			defaultValue: 'assessment',
		},
		created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
		updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
	});

	await queryInterface.addIndex('round_stages', ['round_id', 'code'], {
		unique: true,
		name: 'round_stages_round_code_unique',
	});
	await queryInterface.addIndex('round_stages', ['round_id', 'sort_order'], {
		name: 'round_stages_round_sort_idx',
	});

	await queryInterface.createTable('stage_questions', {
		id: { type: DataTypes.BIGINT, autoIncrement: true, primaryKey: true },
		stage_id: {
			type: DataTypes.BIGINT,
			allowNull: false,
			references: { model: 'round_stages', key: 'id' },
			onUpdate: 'CASCADE',
			onDelete: 'CASCADE',
		},
		prompt: { type: DataTypes.TEXT, allowNull: false },
		subject: {
			type: DataTypes.ENUM('Gujarati', 'Maths', 'All'),
			allowNull: false,
			defaultValue: 'All',
		},
		sort_order: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
		created_by_teacher_id: { type: DataTypes.STRING(50), allowNull: true },
		created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
		updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
	});

	await queryInterface.addIndex('stage_questions', ['stage_id', 'sort_order'], {
		name: 'stage_questions_stage_sort_idx',
	});

	await queryInterface.createTable('teacher_stage_progress', {
		id: { type: DataTypes.BIGINT, autoIncrement: true, primaryKey: true },
		stage_id: {
			type: DataTypes.BIGINT,
			allowNull: false,
			references: { model: 'round_stages', key: 'id' },
			onUpdate: 'CASCADE',
			onDelete: 'CASCADE',
		},
		teacher_id: { type: DataTypes.STRING(50), allowNull: false },
		school_id: { type: DataTypes.STRING(50), allowNull: false },
		status: {
			type: DataTypes.ENUM('locked', 'active', 'completed'),
			allowNull: false,
			defaultValue: 'locked',
		},
		started_at: { type: DataTypes.DATE, allowNull: true },
		completed_at: { type: DataTypes.DATE, allowNull: true },
		created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
		updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
	});

	await queryInterface.addIndex('teacher_stage_progress', ['stage_id', 'teacher_id', 'school_id'], {
		unique: true,
		name: 'teacher_stage_progress_unique',
	});
	await queryInterface.addIndex('teacher_stage_progress', ['teacher_id', 'school_id'], {
		name: 'teacher_stage_progress_teacher_idx',
	});

	await queryInterface.createTable('stage_interventions', {
		id: { type: DataTypes.BIGINT, autoIncrement: true, primaryKey: true },
		stage_id: {
			type: DataTypes.BIGINT,
			allowNull: false,
			references: { model: 'round_stages', key: 'id' },
			onUpdate: 'CASCADE',
			onDelete: 'CASCADE',
		},
		teacher_id: { type: DataTypes.STRING(50), allowNull: false },
		school_id: { type: DataTypes.STRING(50), allowNull: false },
		student_id: { type: DataTypes.STRING(50), allowNull: false },
		subject: {
			type: DataTypes.ENUM('Gujarati', 'Maths'),
			allowNull: false,
		},
		actions_json: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
		notes: { type: DataTypes.TEXT, allowNull: false, defaultValue: '' },
		created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
		updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
	});

	await queryInterface.addIndex('stage_interventions', ['stage_id', 'teacher_id', 'student_id', 'subject'], {
		unique: true,
		name: 'stage_interventions_unique',
	});

	// Attach assessments to a stage within the round
	await queryInterface.addColumn('student_reviews', 'stage_id', {
		type: DataTypes.BIGINT,
		allowNull: true,
		references: { model: 'round_stages', key: 'id' },
		onUpdate: 'CASCADE',
		onDelete: 'SET NULL',
	});

	// Seed Baseline / Midline / Endline for every existing round
	const [rounds] = await queryInterface.sequelize.query(`SELECT id FROM review_rounds ORDER BY id ASC`);
	for (const round of rounds as Array<{ id: number }>) {
		await queryInterface.bulkInsert('round_stages', [
			{
				round_id: round.id,
				code: 'baseline',
				name: 'Baseline',
				description: 'First assessment of every student for Gujarati and Maths.',
				sort_order: 1,
				stage_type: 'assessment',
				created_at: new Date(),
				updated_at: new Date(),
			},
			{
				round_id: round.id,
				code: 'midline',
				name: 'Midline',
				description: 'Plan interventions and re-assess students moving toward નિપુણ.',
				sort_order: 2,
				stage_type: 'intervention',
				created_at: new Date(),
				updated_at: new Date(),
			},
			{
				round_id: round.id,
				code: 'endline',
				name: 'Endline',
				description: 'Final assessment and summary of progress in this round.',
				sort_order: 3,
				stage_type: 'summary',
				created_at: new Date(),
				updated_at: new Date(),
			},
		]);
	}

	// Backfill existing reviews onto baseline stage of their round
	await queryInterface.sequelize.query(`
		UPDATE student_reviews sr
		SET stage_id = rs.id
		FROM round_stages rs
		WHERE sr.stage_id IS NULL
		  AND rs.round_id = sr.round_id
		  AND rs.code = 'baseline'
	`);

	await queryInterface.removeIndex('student_reviews', 'student_reviews_student_year_round_subject_unique');
	await queryInterface.addIndex(
		'student_reviews',
		['student_id', 'academic_year', 'round_id', 'stage_id', 'subject'],
		{
			unique: true,
			name: 'student_reviews_student_year_round_stage_subject_unique',
		},
	);
}

export async function down(queryInterface: QueryInterface): Promise<void> {
	await queryInterface.removeIndex('student_reviews', 'student_reviews_student_year_round_stage_subject_unique');
	await queryInterface.addIndex('student_reviews', ['student_id', 'academic_year', 'round_id', 'subject'], {
		unique: true,
		name: 'student_reviews_student_year_round_subject_unique',
	});
	await queryInterface.removeColumn('student_reviews', 'stage_id');
	await queryInterface.dropTable('stage_interventions');
	await queryInterface.dropTable('teacher_stage_progress');
	await queryInterface.dropTable('stage_questions');
	await queryInterface.dropTable('round_stages');
	await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_round_stages_stage_type";');
	await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_stage_questions_subject";');
	await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_teacher_stage_progress_status";');
	await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_stage_interventions_subject";');
}
