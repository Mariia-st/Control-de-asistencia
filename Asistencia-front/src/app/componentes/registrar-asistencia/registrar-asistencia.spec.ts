import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RegisterAttendance } from './registrar-asistencia';

describe('RegisterAttendance', () => {
  let component: RegisterAttendance;
  let fixture: ComponentFixture<RegisterAttendance>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RegisterAttendance]
    })
    .compileComponents();

    fixture = TestBed.createComponent(RegisterAttendance);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
