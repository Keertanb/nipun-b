import {
	Table,
	Column,
	Model,
	DataType,
	PrimaryKey,
	AutoIncrement,
	AllowNull,
	CreatedAt,
} from 'sequelize-typescript';

@Table({ tableName: 'otp_log', timestamps: false, underscored: true })
export class OtpLog extends Model {
	@PrimaryKey
	@AutoIncrement
	@Column(DataType.BIGINT)
	id!: number;

	@AllowNull(false)
	@Column({ field: 'user_name', type: DataType.STRING(100) })
	userName!: string;

	@AllowNull(false)
	@Column({ field: 'email', type: DataType.STRING(255) })
	email!: string;

	@AllowNull(false)
	@Column({ field: 'otp_code', type: DataType.STRING(10) })
	otpCode!: string;

	@AllowNull(false)
	@Column({ field: 'expires_at', type: DataType.DATE })
	expiresAt!: Date;

	@CreatedAt
	@Column({ field: 'created_at', type: DataType.DATE })
	createdAt!: Date;
}

export default OtpLog;
