import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface): Promise<void> {
	await queryInterface.createTable('user_sessions', {
		id: {
			type: DataTypes.BIGINT,
			autoIncrement: true,
			primaryKey: true,
		},
		entity_id: {
			type: DataTypes.BIGINT,
			allowNull: false,
		},
		token: {
			type: DataTypes.STRING(512),
			allowNull: false,
		},
		ip_address: {
			type: DataTypes.STRING(45),
			allowNull: true,
		},
		created_at: {
			type: DataTypes.DATE,
			allowNull: false,
			defaultValue: DataTypes.NOW,
		},
		school_id: {
			type: DataTypes.STRING(50),
			allowNull: true,
		},
		role_type: {
			type: DataTypes.STRING(20),
			allowNull: true,
		},
	});

	await queryInterface.addIndex('user_sessions', ['entity_id']);
	await queryInterface.addIndex('user_sessions', ['token'], { unique: true });
	await queryInterface.addIndex('user_sessions', ['school_id', 'role_type']);
}

export async function down(queryInterface: QueryInterface): Promise<void> {
	await queryInterface.dropTable('user_sessions');
}
