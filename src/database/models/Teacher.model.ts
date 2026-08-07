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
	Unique,
} from 'sequelize-typescript';

@Table({ tableName: 'teachers', timestamps: true, underscored: true })
export class Teacher extends Model {
	@PrimaryKey
	@AutoIncrement
	@Column(DataType.BIGINT)
	id!: number;

	@Unique
	@AllowNull(false)
	@Column({ field: 'teacher_code', type: DataType.STRING(50) })
	teacherCode!: string;

	@AllowNull(false)
	@Column({ type: DataType.STRING(20) })
	mobile!: string;

	@AllowNull(true)
	@Column({ field: 'teacher_name', type: DataType.STRING(200) })
	teacherName!: string | null;

	@AllowNull(true)
	@Column({ type: DataType.STRING(100) })
	designation!: string | null;

	@AllowNull(true)
	@Column({ field: 'school_id', type: DataType.STRING(50) })
	schoolId!: string | null;

	@CreatedAt
	@Column({ field: 'created_at', type: DataType.DATE })
	createdAt!: Date;

	@UpdatedAt
	@Column({ field: 'updated_at', type: DataType.DATE })
	updatedAt!: Date;
}

export default Teacher;
