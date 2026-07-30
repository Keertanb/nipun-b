import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface): Promise<void> {
	await queryInterface.createTable('student_reviews', {
		id: {
			type: DataTypes.BIGINT,
			autoIncrement: true,
			primaryKey: true,
		},
		student_id: {
			type: DataTypes.STRING(50),
			allowNull: false,
		},
		school_id: {
			type: DataTypes.STRING(50),
			allowNull: false,
		},
		teacher_id: {
			type: DataTypes.STRING(50),
			allowNull: false,
		},
		academic_year: {
			type: DataTypes.STRING(10),
			allowNull: false,
		},
		grade: {
			type: DataTypes.STRING(10),
			allowNull: true,
		},
		review: {
			type: DataTypes.ENUM('Good', 'Average', 'Bad'),
			allowNull: false,
		},
		remarks: {
			type: DataTypes.TEXT,
			allowNull: false,
			defaultValue: '',
		},
		reviewed_at: {
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

	await queryInterface.addIndex('student_reviews', ['student_id', 'academic_year'], {
		unique: true,
		name: 'student_reviews_student_year_unique',
	});
	await queryInterface.addIndex('student_reviews', ['teacher_id', 'academic_year']);
	await queryInterface.addIndex('student_reviews', ['school_id', 'academic_year']);
}

export async function down(queryInterface: QueryInterface): Promise<void> {
	await queryInterface.dropTable('student_reviews');
}
