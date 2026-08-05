import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface): Promise<void> {
	await queryInterface.addColumn('student_reviews', 'subject', {
		type: DataTypes.ENUM('Gujarati', 'Maths'),
		allowNull: true,
	});

	// Existing single reviews become Gujarati; Maths still required for Completed
	await queryInterface.sequelize.query(`
		UPDATE student_reviews
		SET subject = 'Gujarati'
		WHERE subject IS NULL
	`);

	await queryInterface.changeColumn('student_reviews', 'subject', {
		type: DataTypes.ENUM('Gujarati', 'Maths'),
		allowNull: false,
	});

	await queryInterface.removeIndex('student_reviews', 'student_reviews_student_year_round_unique');
	await queryInterface.addIndex('student_reviews', ['student_id', 'academic_year', 'round_id', 'subject'], {
		unique: true,
		name: 'student_reviews_student_year_round_subject_unique',
	});
}

export async function down(queryInterface: QueryInterface): Promise<void> {
	await queryInterface.removeIndex('student_reviews', 'student_reviews_student_year_round_subject_unique');
	await queryInterface.addIndex('student_reviews', ['student_id', 'academic_year', 'round_id'], {
		unique: true,
		name: 'student_reviews_student_year_round_unique',
	});
	await queryInterface.removeColumn('student_reviews', 'subject');
	await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_student_reviews_subject";');
}
