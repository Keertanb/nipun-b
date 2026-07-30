import { Table, Column, Model, DataType, PrimaryKey, AutoIncrement, AllowNull, Default, CreatedAt } from 'sequelize-typescript';

@Table({ tableName: 'user_sessions', timestamps: false })
export class UserSession extends Model {
	@PrimaryKey
	@AutoIncrement
	@Column(DataType.BIGINT)
	id!: number;

	@AllowNull(false)
	@Column({ field: 'entity_id', type: DataType.BIGINT })
	entityId!: number;

	@AllowNull(false)
	@Column(DataType.STRING(512))
	token!: string;

	@AllowNull(true)
	@Column({ field: 'ip_address', type: DataType.STRING(45) })
	ipAddress!: string | null;

	@Default(DataType.NOW)
	@AllowNull(false)
	@CreatedAt
	@Column({ field: 'created_at', type: DataType.DATE })
	createdAt!: Date;

	@AllowNull(true)
	@Column({ field: 'school_id', type: DataType.STRING(50) })
	schoolId!: string | null;

	@AllowNull(true)
	@Column({ field: 'role_type', type: DataType.STRING(20) })
	roleType!: string | null;
}

export default UserSession;
