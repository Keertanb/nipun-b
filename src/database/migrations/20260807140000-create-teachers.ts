import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface): Promise<void> {
	await queryInterface.createTable('teachers', {
		id: {
			type: DataTypes.BIGINT,
			autoIncrement: true,
			primaryKey: true,
		},
		teacher_code: {
			type: DataTypes.STRING(50),
			allowNull: false,
		},
		mobile: {
			type: DataTypes.STRING(20),
			allowNull: false,
		},
		teacher_name: {
			type: DataTypes.STRING(200),
			allowNull: true,
		},
		designation: {
			type: DataTypes.STRING(100),
			allowNull: true,
		},
		school_id: {
			type: DataTypes.STRING(50),
			allowNull: true,
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

	await queryInterface.addIndex('teachers', ['teacher_code'], { unique: true });
	await queryInterface.addIndex('teachers', ['mobile']);
}

export async function down(queryInterface: QueryInterface): Promise<void> {
	await queryInterface.dropTable('teachers');
}
