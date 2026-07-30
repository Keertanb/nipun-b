export type SchoolDetailsResponseType = {
	schoolid: string;
	school: string;
	village: string;
	block: string;
	district: string;
	nameprincipal: string;
	mobileprincipal: string;
	isactive: boolean;
	udise?: string;
	cluster?: string;
};

export type TeacherResponseType = {
	teachercode: string;
	schoolid: string;
	teachername: string;
	designation: string;
	isactive: boolean;
};

export type StudentResponseType = {
	studentid: string;
	schoolid: string;
	name: string;
	mothername: string | null;
	gender: string;
	grade: number;
	section: string;
	dob: string;
	gr_no: string;
	is_active: boolean;
};
