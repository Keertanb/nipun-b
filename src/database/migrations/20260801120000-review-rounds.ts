import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface): Promise<void> {
	await queryInterface.createTable('review_rounds', {
		id: {
			type: DataTypes.BIGINT,
			autoIncrement: true,
			primaryKey: true,
		},
		academic_year: {
			type: DataTypes.STRING(10),
			allowNull: false,
		},
		round_number: {
			type: DataTypes.INTEGER,
			allowNull: false,
		},
		name: {
			type: DataTypes.STRING(100),
			allowNull: false,
			defaultValue: '',
		},
		start_date: {
			type: DataTypes.DATEONLY,
			allowNull: false,
		},
		end_date: {
			type: DataTypes.DATEONLY,
			allowNull: false,
		},
		created_at: {
			type: DataTypes.DATE,
			allowNull: false,
			defaultValue: DataTypes.NOW,
		},
		updated_at: {
			type: DataTypes.DATE,
			allowNull: false,
			defaultValue: DataTypes.NOW,
		},
	});

	await queryInterface.addIndex('review_rounds', ['academic_year', 'round_number'], {
		unique: true,
		name: 'review_rounds_year_number_unique',
	});

	// Seed Round 1 for current academic year (open window)
	const academicYear = process.env.ACADEMIC_YEAR || '2026-27';
	await queryInterface.bulkInsert('review_rounds', [
		{
			academic_year: academicYear,
			round_number: 1,
			name: 'Round 1',
			start_date: '2026-04-01',
			end_date: '2026-12-31',
			created_at: new Date(),
			updated_at: new Date(),
		},
	]);

	await queryInterface.addColumn('student_reviews', 'round_id', {
		type: DataTypes.BIGINT,
		allowNull: true,
		references: {
			model: 'review_rounds',
			key: 'id',
		},
		onUpdate: 'CASCADE',
		onDelete: 'RESTRICT',
	});

	// Attach existing reviews to Round 1 of their academic year (or seeded year)
	await queryInterface.sequelize.query(`
		UPDATE student_reviews sr
		SET round_id = rr.id
		FROM review_rounds rr
		WHERE sr.round_id IS NULL
		  AND rr.round_number = 1
		  AND rr.academic_year = sr.academic_year
	`);

	await queryInterface.sequelize.query(`
		UPDATE student_reviews sr
		SET round_id = (
			SELECT id FROM review_rounds WHERE round_number = 1 ORDER BY id ASC LIMIT 1
		)
		WHERE sr.round_id IS NULL
	`);

	await queryInterface.changeColumn('student_reviews', 'round_id', {
		type: DataTypes.BIGINT,
		allowNull: false,
	});

	await queryInterface.removeIndex('student_reviews', 'student_reviews_student_year_unique');
	await queryInterface.addIndex('student_reviews', ['student_id', 'academic_year', 'round_id'], {
		unique: true,
		name: 'student_reviews_student_year_round_unique',
	});
	await queryInterface.addIndex('student_reviews', ['round_id'], {
		name: 'student_reviews_round_id_idx',
	});
}

export async function down(queryInterface: QueryInterface): Promise<void> {
	await queryInterface.removeIndex('student_reviews', 'student_reviews_round_id_idx');
	await queryInterface.removeIndex('student_reviews', 'student_reviews_student_year_round_unique');
	await queryInterface.addIndex('student_reviews', ['student_id', 'academic_year'], {
		unique: true,
		name: 'student_reviews_student_year_unique',
	});
	await queryInterface.removeColumn('student_reviews', 'round_id');
	await queryInterface.dropTable('review_rounds');
}
