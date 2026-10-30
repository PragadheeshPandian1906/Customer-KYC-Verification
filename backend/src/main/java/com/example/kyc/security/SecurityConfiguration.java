package com.example.kyc.security;

import com.example.kyc.auth.SessionAuthenticationFilter;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.dao.DaoAuthenticationProvider;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.ObjectPostProcessor;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.csrf.CsrfFilter;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.security.web.csrf.CookieCsrfTokenRepository;
import org.springframework.security.web.csrf.MissingCsrfTokenException;
import org.springframework.security.web.csrf.InvalidCsrfTokenException;

@Configuration
@EnableWebSecurity
@EnableMethodSecurity
public class SecurityConfiguration {
    @Bean
    PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder(12);
    }

    @Bean
    DaoAuthenticationProvider authenticationProvider(UserDetailsService userDetailsService,
                                                      PasswordEncoder passwordEncoder) {
        DaoAuthenticationProvider provider = new DaoAuthenticationProvider(userDetailsService);
        provider.setPasswordEncoder(passwordEncoder);
        return provider;
    }

    @Bean
    AuthenticationManager authenticationManager(AuthenticationConfiguration configuration) throws Exception {
        return configuration.getAuthenticationManager();
    }

    @Bean
    SecurityFilterChain securityFilterChain(HttpSecurity http,
                                            SessionAuthenticationFilter sessionFilter,
                                            ObjectMapper objectMapper) throws Exception {
        CookieCsrfTokenRepository csrfRepository = CookieCsrfTokenRepository.withHttpOnlyFalse();
        csrfRepository.setCookieCustomizer(cookie -> cookie.path("/").sameSite("Strict"));
        return http
            .csrf(csrf -> csrf
                .csrfTokenRepository(csrfRepository)
                .withObjectPostProcessor(new ObjectPostProcessor<CsrfFilter>() {
                    @Override
                    public <O extends CsrfFilter> O postProcess(O filter) {
                        filter.setAccessDeniedHandler((request, response, exception) -> {
                            if (exception instanceof InvalidCsrfTokenException
                                || exception instanceof MissingCsrfTokenException) {
                                writeCsrfProblem(objectMapper, request, response);
                            } else {
                                writeProblem(objectMapper, request, response, HttpStatus.FORBIDDEN,
                                    "Request is not permitted");
                            }
                        });
                        return filter;
                    }
                }))
            .authorizeHttpRequests(authorize -> authorize
                .requestMatchers("/api/v1/auth/csrf", "/api/v1/auth/login",
                    "/v3/api-docs/**", "/swagger-ui/**", "/swagger-ui.html").permitAll()
                .anyRequest().authenticated())
            .addFilterBefore(sessionFilter, UsernamePasswordAuthenticationFilter.class)
            .exceptionHandling(exceptions -> exceptions
                .authenticationEntryPoint((request, response, exception) ->
                    writeProblem(objectMapper, request, response, HttpStatus.UNAUTHORIZED,
                        "Authentication required"))
                .accessDeniedHandler((request, response, exception) ->
                    writeProblem(objectMapper, request, response, HttpStatus.FORBIDDEN,
                        "Request is not permitted")))
            .build();
    }

    @Bean
    FilterRegistrationBean<SessionAuthenticationFilter> disableContainerRegistration(
        SessionAuthenticationFilter sessionFilter) {
        FilterRegistrationBean<SessionAuthenticationFilter> registration = new FilterRegistrationBean<>(sessionFilter);
        registration.setEnabled(false);
        return registration;
    }

    private static void writeProblem(ObjectMapper objectMapper, jakarta.servlet.http.HttpServletRequest request,
                                     jakarta.servlet.http.HttpServletResponse response,
                                     HttpStatus status, String message) throws java.io.IOException {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(status, message);
        problem.setTitle(status.getReasonPhrase());
        Object correlationId = request.getAttribute("correlationId");
        if (correlationId instanceof String id) {
            problem.setProperty("correlationId", id);
        }
        response.setStatus(status.value());
        response.setContentType("application/problem+json");
        objectMapper.writeValue(response.getOutputStream(), problem);
    }

    private static void writeCsrfProblem(ObjectMapper objectMapper,
                                         jakarta.servlet.http.HttpServletRequest request,
                                         jakarta.servlet.http.HttpServletResponse response)
        throws java.io.IOException {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(HttpStatus.FORBIDDEN,
            "CSRF token is missing or invalid");
        problem.setTitle(HttpStatus.FORBIDDEN.getReasonPhrase());
        problem.setProperty("code", "CSRF_INVALID");
        Object correlationId = request.getAttribute("correlationId");
        if (correlationId instanceof String id) {
            problem.setProperty("correlationId", id);
        }
        response.setStatus(HttpStatus.FORBIDDEN.value());
        response.setContentType("application/problem+json");
        objectMapper.writeValue(response.getOutputStream(), problem);
    }
}
