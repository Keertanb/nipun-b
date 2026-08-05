import {
	Table,
	Column,
	Model,
	DataType,
	PrimaryKey,
	AutoIncrement,
	AllowNull,
	CreatedAt,
	UpdatedAt,
} from 'sequelize-typescript';

@Table({ tableName: 'review_rounds', timestamps: true, underscored: true })
export class ReviewRound extends Model {
	@PrimaryKey
	@AutoIncrement
	@Column(DataType.BIGINT)
	id!: number;

	@AllowNull(false)
	@Column({ field: 'academic_year', type: DataType.STRING(10) })
	academicYear!: string;

	@AllowNull(false)
	@Column({ field: 'round_number', type: DataType.INTEGER })
	roundNumber!: number;

	@AllowNull(false)
	@Column({ type: DataType.STRING(100), defaultValue: '' })
	name!: string;

	@AllowNull(false)
	@Column({ field: 'start_date', type: DataType.DATEONLY })
	startDate!: string;

	@AllowNull(false)
	@Column({ field: 'end_date', type: DataType.DATEONLY })
	endDate!: string;

	@CreatedAt
	@Column({ field: 'created_at', type: DataType.DATE })
	createdAt!: Date;

	@UpdatedAt
	@Column({ field: 'updated_at', type: DataType.DATE })
	updatedAt!: Date;
}

export default ReviewRound;
